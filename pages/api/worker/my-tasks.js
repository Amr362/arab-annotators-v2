/**
 * GET /api/worker/my-tasks
 *
 * Returns the authenticated worker's task queue in order.
 * Includes task details, current position, and queue stats.
 *
 * Query params:
 *   status  — filter by status (pending|in_progress|completed|all)  default: all
 *   limit   — page size (default: 25, max: 100)
 *   offset  — pagination offset (default: 0)
 *
 * Response:
 * {
 *   tasks: [...],
 *   queue_stats: { total, pending, in_progress, completed, current_position },
 *   pagination: { limit, offset, has_more }
 * }
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'غير مصرح' })

  const admin = getAdminClient()

  // Parse query params
  const status  = req.query.status  || 'all'
  const limit   = Math.min(parseInt(req.query.limit  || '25', 10), 100)
  const offset  = parseInt(req.query.offset || '0', 10)

  const validStatuses = ['pending', 'in_progress', 'completed', 'reviewed', 'reassigned', 'all']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status غير صحيح. استخدم: ${validStatuses.join(', ')}` })
  }

  // Build task_assignments query
  let query = admin
    .from('task_assignments')
    .select(`
      id,
      task_id,
      status,
      queue_position,
      assigned_at,
      started_at,
      completed_at,
      locked_by,
      locked_at,
      task:task_id (
        id,
        proverb,
        context_sentences,
        status,
        created_at
      ),
      annotation:task_id (
        id,
        response_1,
        response_2,
        response_3,
        submitted_at
      )
    `, { count: 'exact' })
    .eq('worker_id', user.id)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  query = query
    .order('queue_position', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data: assignments, count, error: assignError } = await query

  if (assignError) {
    return res.status(500).json({ error: assignError.message })
  }

  // Get queue stats (separate fast query, no join needed)
  const { data: statsRaw } = await admin
    .from('task_assignments')
    .select('status')
    .eq('worker_id', user.id)

  const statsCounts = { pending: 0, in_progress: 0, completed: 0, reviewed: 0 }
  for (const row of statsRaw || []) {
    if (statsCounts[row.status] !== undefined) statsCounts[row.status]++
  }

  // Get worker queue metadata
  const { data: queueMeta } = await admin
    .from('worker_queues')
    .select('current_position, total_assigned, last_active_at')
    .eq('worker_id', user.id)
    .single()

  // Update last_active_at (don't await — fire and forget)
  admin.from('worker_queues').upsert({
    worker_id: user.id,
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'worker_id' }).then(() => {}).catch(() => {})

  return res.status(200).json({
    tasks: assignments || [],
    queue_stats: {
      total:       queueMeta?.total_assigned || count || 0,
      pending:     statsCounts.pending,
      in_progress: statsCounts.in_progress,
      completed:   statsCounts.completed,
      reviewed:    statsCounts.reviewed,
      current_position: queueMeta?.current_position || 0,
    },
    pagination: {
      limit,
      offset,
      total: count || 0,
      has_more: (offset + limit) < (count || 0),
    },
  })
}
