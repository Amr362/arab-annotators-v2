// pages/api/users/delete-account.js
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createServerSupabaseClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

    const userId = session.user.id
    const admin = getAdminClient()

    // حذف الـ profile (الـ CASCADE بيمسح annotations و reviews تلقائياً)
    await admin.from('profiles').delete().eq('id', userId)

    // حذف الـ auth user
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[delete-account]', err.message)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
