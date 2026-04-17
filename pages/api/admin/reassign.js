/**
 * POST /api/admin/reassign
 *
 * Detects workers inactive for N hours and redistributes their
 * pending/in_progress tasks to active workers.
 *
 * Body: { inactive_hours?: number (default: 24) }
 *
 * Response:
 * {
 *   reassigned_count, from_workers, to_workers,
 *   details: [{ task_id, from_worker, to_worker }]
 * }
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'
import { calculateDistribution, chunkArray } from '../../../lib/distributor'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'غير مصرح' })

  const admin = getAdminClient()

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'للمديرين فقط' })
  }

  const { inactive_hours = 24 } = req.body || {}

  // ── Find inactive workers with remaining tasks ──────────────────────────
  const { data: inactiveWorkers, error: inactiveErr } = await admin
    .rpc('get_inactive_workers', { p_hours: inactive_hours })

  if (inactiveErr) return res.status(500).json({ error: inactiveErr.message })
  if (!inactiveWorkers?.length) {
    return res.status(200).json({ message: 'لا يوجد مشغلون غير نشطين بمهام معلقة', reassigned_count: 0 })
  }

  const inactiveWorkerIds = inactiveWorkers.map(w => w.worker_id)

  // ── Get tasks to reassign ───────────────────────────────────────────────
  const { data: stuckAssignments } = await admin
    .from('task_assignments')
    .select('id, task_id, worker_id')
    .in('worker_id', inactiveWorkerIds)
    .in('status', ['pending', 'in_progress'])

  if (!stuckAssignments?.length) {
    return res.status(200).json({ message: 'لا توجد مهام معلقة', reassigned_count: 0 })
  }

  // ── Get available active workers ────────────────────────────────────────
  const { data: activeWorkers } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'tasker')
    .eq('is_active', true)
    .not('id', 'in', `(${inactiveWorkerIds.join(',')})`)

  if (!activeWorkers?.length) {
    return res.status(400).json({ error: 'لا يوجد مشغلون نشطون لإعادة التوزيع' })
  }

  // Get active workers' current load
  const { data: loads } = await admin
    .from('task_assignments')
    .select('worker_id')
    .in('worker_id', activeWorkers.map(w => w.id))
    .in('status', ['pending', 'in_progress'])

  const loadMap = {}
  for (const w of activeWorkers) loadMap[w.id] = 0
  for (const l of loads || []) { if (loadMap[l.worker_id] !== undefined) loadMap[l.worker_id]++ }

  const workersWithLoad = activeWorkers.map(w => ({ id: w.id, current_load: loadMap[w.id] || 0 }))

  // ── Calculate new distribution ──────────────────────────────────────────
  const taskIdsToReassign = stuckAssignments.map(a => a.task_id)
  const { assignments: newAssignments } = calculateDistribution(workersWithLoad, taskIdsToReassign)

  // Build task_id → new assignment map
  const reassignMap = {}
  for (const a of newAssignments) reassignMap[a.task_id] = a.worker_id

  // ── Apply reassignments ─────────────────────────────────────────────────
  const details = []
  const now = new Date().toISOString()

  const chunks = chunkArray(stuckAssignments, 100)
  for (const chunk of chunks) {
    for (const old of chunk) {
      const newWorkerId = reassignMap[old.task_id]
      if (!newWorkerId) continue

      // Mark old assignment as reassigned
      await admin
        .from('task_assignments')
        .update({ status: 'reassigned', updated_at: now })
        .eq('id', old.id)

      // Get current max queue position for new worker
      const { data: maxPos } = await admin
        .from('task_assignments')
        .select('queue_position')
        .eq('worker_id', newWorkerId)
        .order('queue_position', { ascending: false })
        .limit(1)
        .single()

      const nextPos = (maxPos?.queue_position || 0) + 1

      // Insert new assignment
      await admin.from('task_assignments').insert({
        task_id: old.task_id,
        worker_id: newWorkerId,
        status: 'pending',
        queue_position: nextPos,
        reassigned_from: old.worker_id,
        reassigned_at: now,
        assigned_at: now,
      })

      // Update tasks.assigned_to
      await admin.from('tasks').update({ assigned_to: newWorkerId, updated_at: now }).eq('id', old.task_id)

      details.push({
        task_id: old.task_id,
        from_worker: inactiveWorkers.find(w => w.worker_id === old.worker_id)?.full_name || old.worker_id,
        to_worker: activeWorkers.find(w => w.id === newWorkerId)?.full_name || newWorkerId,
      })
    }
  }

  // Audit log
  await admin.from('audit_log').insert({
    user_id: user.id,
    action: 'reassign_tasks',
    table_name: 'task_assignments',
    new_data: {
      reassigned_count: details.length,
      from_workers: inactiveWorkerIds.length,
      inactive_hours,
    },
  })

  return res.status(200).json({
    reassigned_count: details.length,
    from_workers: inactiveWorkerIds.length,
    to_workers: activeWorkers.length,
    details,
  })
}
