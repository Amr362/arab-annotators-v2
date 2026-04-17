// pages/api/users/ensure-profile.js
// ينشئ الـ profile تلقائياً لو مش موجود — بيتستخدم من ProfileProvider
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const admin = getAdminClient()

    // اجيب بيانات الـ auth user
    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(userId)
    if (userError || !user) {
      return res.status(404).json({ error: 'Auth user not found' })
    }

    // upsert الـ profile
    const { data: profile, error: upsertError } = await admin
      .from('profiles')
      .upsert({
        id:         user.id,
        email:      user.email,
        full_name:  user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role:       user.user_metadata?.role || 'tasker',
        is_active:  true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single()

    if (upsertError) {
      console.error('[ensure-profile] upsert error:', upsertError.message)
      return res.status(500).json({ error: upsertError.message })
    }

    return res.status(200).json({ profile })
  } catch (err) {
    console.error('[ensure-profile] error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
