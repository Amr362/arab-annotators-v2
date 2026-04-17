/**
 * GET /api/admin/distribution-stats
 * Returns comprehensive distribution analytics for the admin dashboard.
 */

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseServer = createPagesServerClient({ req, res })
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'غير مصرح' })

  const admin = getAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'للمديرين فقط' })
  }

  const [
    { data: workerPerf },
    { data: batches },
    { data: taskCounts },
    { data: assignmentCounts },
  ] = await Promise.all([
    admin.from('worker_performance').select('*').order('completion_rate', { ascending: false }),
    admin.from('distribution_batches').select('*').order('started_at', { ascending: false }).limit(10),
    admin.from('tasks').select('status'),
    admin.from('task_assignments').select('status'),
  ])

  // Task status breakdown
  const taskStats = {}
  for (const t of taskCounts || []) {
    taskStats[t.status] = (taskStats[t.status] || 0) + 1
  }

  // Assignment status breakdown
  const assignStats = {}
  for (const a of assignmentCounts || []) {
    assignStats[a.status] = (assignStats[a.status] || 0) + 1
  }

  return res.status(200).json({
    worker_performance: workerPerf || [],
    recent_batches: batches || [],
    task_stats: taskStats,
    assignment_stats: assignStats,
    totals: {
      tasks: taskCounts?.length || 0,
      assignments: assignmentCounts?.length || 0,
      workers: workerPerf?.length || 0,
    },
  })
}
