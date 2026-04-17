/**
 * POST /api/task/complete
 *
 * Marks a task as completed and saves the annotation.
 * Uses atomic PostgreSQL function to prevent race conditions.
 *
 * Body:
 * {
 *   assignment_id: string,
 *   task_id: string,
 *   response_1: string,
 *   response_2: string,
 *   response_3: string,
 *   notes?: string
 * }
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

function sanitize(str) {
  return str?.replace(/<[^>]*>/g, '').trim() || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'غير مصرح' })

  const admin = getAdminClient()

  const {
    assignment_id,
    task_id,
    response_1,
    response_2,
    response_3,
    notes = '',
  } = req.body || {}

  if (!assignment_id || !task_id) {
    return res.status(400).json({ error: 'assignment_id و task_id مطلوبان' })
  }

  const r1 = sanitize(response_1)
  const r2 = sanitize(response_2)
  const r3 = sanitize(response_3)

  if (!r1 || !r2 || !r3) {
    return res.status(400).json({ error: 'الجمل الثلاث مطلوبة كاملة' })
  }

  // Verify assignment belongs to this worker
  const { data: assignment } = await admin
    .from('task_assignments')
    .select('id, worker_id, status, task_id')
    .eq('id', assignment_id)
    .eq('worker_id', user.id)
    .single()

  if (!assignment) {
    return res.status(404).json({ error: 'التكليف غير موجود أو لا ينتمي لك' })
  }
  if (assignment.status === 'completed') {
    return res.status(409).json({ error: 'هذه المهمة مكتملة بالفعل' })
  }
  if (assignment.status !== 'in_progress') {
    return res.status(409).json({ error: `لا يمكن إكمال مهمة بحالة: ${assignment.status}` })
  }

  const now = new Date().toISOString()

  // Upsert annotation
  const { data: annotationData, error: annotationError } = await admin
    .from('annotations')
    .upsert({
      task_id,
      annotator_id: user.id,
      response_1: r1,
      response_2: r2,
      response_3: r3,
      notes: sanitize(notes),
      submitted_at: now,
      updated_at: now,
    }, { onConflict: 'task_id,annotator_id' })
    .select()
    .single()

  if (annotationError) {
    return res.status(500).json({ error: 'خطأ في حفظ الإجابة: ' + annotationError.message })
  }

  // Mark assignment complete (uses atomic DB function)
  const { data: success, error: completeError } = await admin
    .rpc('complete_task_assignment', {
      p_assignment_id: assignment_id,
      p_worker_id: user.id,
    })

  if (completeError) {
    return res.status(500).json({ error: 'خطأ في إكمال المهمة: ' + completeError.message })
  }

  if (!success) {
    return res.status(409).json({ error: 'فشل تحديث حالة المهمة — ربما تغيرت الحالة' })
  }

  // Audit log (fire and forget)
  admin.from('audit_log').insert({
    user_id: user.id,
    action: 'complete_task',
    table_name: 'task_assignments',
    record_id: assignment_id,
    new_data: { task_id, annotation_id: annotationData?.id },
  }).then(() => {}).catch(() => {})

  return res.status(200).json({
    success: true,
    message: 'تم إكمال المهمة بنجاح',
    annotation_id: annotationData?.id,
  })
}
