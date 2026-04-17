/**
 * POST /api/admin/create-tasks
 *
 * Bulk creates tasks and automatically distributes them across all active workers.
 * Uses service role key — never exposed to client.
 *
 * Body:
 * {
 *   tasks: [{ proverb, context_sentences: [s1, s2, s3] }, ...],
 *   shuffle?: boolean   // randomize task order before distribution (default: false)
 * }
 *
 * Response:
 * {
 *   batch_id, total_tasks, total_workers, tasks_per_worker,
 *   distribution: [{ worker_id, count }],
 *   errors: []   // validation errors if any rows were skipped
 * }
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'
import { validateTasks, calculateDistribution, chunkArray, shuffleArray } from '../../../lib/distributor'

const BATCH_SIZE = 500  // rows per bulk insert

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth: must be admin ──────────────────────────────────────────────────
  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) {
    return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول' })
  }

  const admin = getAdminClient()

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'للمديرين فقط' })
  }

  // ── Parse & Validate ─────────────────────────────────────────────────────
  const { tasks: rawTasks, shuffle = false } = req.body || {}
  const { valid: validTasks, errors: validationErrors } = validateTasks(rawTasks)

  if (validTasks.length === 0) {
    return res.status(400).json({ error: 'لا توجد مهام صحيحة', validation_errors: validationErrors })
  }

  // ── Get active workers ───────────────────────────────────────────────────
  const { data: workers, error: workersError } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'tasker')
    .eq('is_active', true)

  if (workersError) {
    return res.status(500).json({ error: 'خطأ في جلب المشغلين: ' + workersError.message })
  }
  if (!workers?.length) {
    return res.status(400).json({ error: 'لا يوجد مشغلون نشطون. أضف مشغلين أولاً.' })
  }

  // Get current workload for each worker (for balanced distribution)
  const { data: workloads } = await admin
    .from('task_assignments')
    .select('worker_id, status')
    .in('worker_id', workers.map(w => w.id))
    .in('status', ['pending', 'in_progress'])

  const workloadMap = {}
  for (const w of workers) workloadMap[w.id] = 0
  for (const wl of workloads || []) {
    if (workloadMap[wl.worker_id] !== undefined) workloadMap[wl.worker_id]++
  }

  const workersWithLoad = workers.map(w => ({ id: w.id, current_load: workloadMap[w.id] || 0 }))

  // ── Calculate distribution ───────────────────────────────────────────────
  let taskList = [...validTasks]
  if (shuffle) taskList = shuffleArray(taskList)

  let distributionResult
  try {
    // We need task IDs — insert tasks first, get their IDs, then assign
    // But we want to avoid partial states. Use a batch record to track.
    distributionResult = null  // will set after insert
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في خوارزمية التوزيع: ' + err.message })
  }

  // ── Create distribution batch record ─────────────────────────────────────
  const { data: batch, error: batchError } = await admin
    .from('distribution_batches')
    .insert({
      created_by: user.id,
      total_tasks: validTasks.length,
      total_workers: workers.length,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      metadata: { shuffle, validation_errors_count: validationErrors.length },
    })
    .select()
    .single()

  if (batchError) {
    return res.status(500).json({ error: 'خطأ في إنشاء الدفعة: ' + batchError.message })
  }

  try {
    // ── Bulk insert tasks ──────────────────────────────────────────────────
    const taskRows = taskList.map(t => ({
      proverb: t.proverb,
      context_sentences: t.context_sentences,
      status: 'pending',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const insertedTaskIds = []
    const taskChunks = chunkArray(taskRows, BATCH_SIZE)

    for (const chunk of taskChunks) {
      const { data: inserted, error: insertError } = await admin
        .from('tasks')
        .insert(chunk)
        .select('id')

      if (insertError) throw new Error('فشل إدراج المهام: ' + insertError.message)
      insertedTaskIds.push(...inserted.map(t => t.id))
    }

    // ── Run distribution algorithm ─────────────────────────────────────────
    const { assignments, stats } = calculateDistribution(workersWithLoad, insertedTaskIds)

    // ── Bulk insert assignments ────────────────────────────────────────────
    const assignmentChunks = chunkArray(assignments, BATCH_SIZE)

    for (const chunk of assignmentChunks) {
      const { error: assignError } = await admin
        .from('task_assignments')
        .insert(chunk)

      if (assignError) throw new Error('فشل إدراج التوزيعات: ' + assignError.message)
    }

    // ── Update tasks.assigned_to for compatibility with existing UI ────────
    // Build a map of task_id → worker_id
    const taskWorkerMap = {}
    for (const a of assignments) taskWorkerMap[a.task_id] = a.worker_id

    // Batch update tasks table (in chunks to avoid timeout)
    const assignmentGroups = {}
    for (const [taskId, workerId] of Object.entries(taskWorkerMap)) {
      if (!assignmentGroups[workerId]) assignmentGroups[workerId] = []
      assignmentGroups[workerId].push(taskId)
    }

    for (const [workerId, taskIds] of Object.entries(assignmentGroups)) {
      const idChunks = chunkArray(taskIds, BATCH_SIZE)
      for (const chunk of idChunks) {
        await admin
          .from('tasks')
          .update({ assigned_to: workerId, updated_at: new Date().toISOString() })
          .in('id', chunk)
      }
    }

    // ── Upsert worker_queues counters ──────────────────────────────────────
    const workerCountMap = {}
    for (const a of assignments) {
      workerCountMap[a.worker_id] = (workerCountMap[a.worker_id] || 0) + 1
    }

    const queueUpserts = Object.entries(workerCountMap).map(([workerId, count]) => ({
      worker_id: workerId,
      total_assigned: (workloadMap[workerId] || 0) + count,
      total_completed: 0,
      total_reviewed: 0,
      is_available: true,
      updated_at: new Date().toISOString(),
    }))

    await admin.from('worker_queues').upsert(queueUpserts, {
      onConflict: 'worker_id',
      ignoreDuplicates: false,
    })

    // ── Mark batch complete ────────────────────────────────────────────────
    await admin.from('distribution_batches').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      tasks_per_worker: stats.base_per_worker,
      remainder_tasks: stats.remainder,
    }).eq('id', batch.id)

    // ── Audit log ─────────────────────────────────────────────────────────
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'bulk_create_distribute_tasks',
      table_name: 'tasks',
      new_data: {
        batch_id: batch.id,
        total_tasks: validTasks.length,
        total_workers: workers.length,
        base_per_worker: stats.base_per_worker,
        remainder: stats.remainder,
      },
    })

    return res.status(201).json({
      success: true,
      batch_id: batch.id,
      total_tasks: validTasks.length,
      total_workers: workers.length,
      tasks_per_worker: stats.base_per_worker,
      remainder: stats.remainder,
      distribution: stats.distribution.map(d => ({
        ...d,
        worker_name: workers.find(w => w.id === d.worker_id)?.full_name,
        worker_email: workers.find(w => w.id === d.worker_id)?.email,
      })),
      validation_errors: validationErrors,
      skipped: rawTasks?.length - validTasks.length,
    })

  } catch (err) {
    // Mark batch as failed
    await admin.from('distribution_batches').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', batch.id)

    console.error('[create-tasks] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Allow large payloads (10k tasks JSON can be ~2MB)
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }
