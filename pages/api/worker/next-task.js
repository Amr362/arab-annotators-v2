/**
 * GET /api/worker/next-task
 *
 * Atomically pulls the worker's next task from their queue.
 * Uses the PostgreSQL function get_next_task_for_worker() for
 * race-condition-safe locking.
 *
 * Response:
 * { task } | { task: null, message: "Queue empty" }
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'غير مصرح' })

  const admin = getAdminClient()

  const { data, error } = await admin.rpc('get_next_task_for_worker', { p_worker_id: user.id })

  if (error) {
    console.error('[next-task]', error)
    return res.status(500).json({ error: error.message })
  }

  if (!data || data.length === 0) {
    return res.status(200).json({ task: null, message: 'طابور المهام فارغ — لا توجد مهام جديدة' })
  }

  const task = data[0]

  // Update last_active (fire and forget)
  admin.from('worker_queues').update({
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('worker_id', user.id).then(() => {}).catch(() => {})

  return res.status(200).json({ task })
}
