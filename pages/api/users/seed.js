import { getAdminClient } from '../../../lib/supabase'

/**
 * One-time seed endpoint — creates initial users
 * Protected by SETUP_SECRET_KEY env var
 * Call: POST /api/users/seed  { "setupKey": "your-secret" }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Body safety
  const body = req.body || {}
  const { setupKey } = body

  const expectedKey = process.env.SETUP_SECRET_KEY
  if (!expectedKey) {
    return res.status(500).json({ error: 'SETUP_SECRET_KEY environment variable is not set' })
  }
  if (setupKey !== expectedKey) {
    return res.status(403).json({ error: 'Invalid setup key' })
  }

  let admin
  try {
    admin = getAdminClient()
  } catch (e) {
    return res.status(500).json({ error: 'Admin client error: ' + e.message })
  }

  const users = [
    {
      email: (process.env.SUPER_ADMIN_EMAIL || 'admin@arab-annotators.com').toLowerCase(),
      password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2024!',
      full_name: 'المدير العام',
      role: 'super_admin',
    },
    {
      email: 'qa1@arab-annotators.com',
      password: 'QA_Reviewer#2024!',
      full_name: 'مراجع الجودة الأول',
      role: 'qa',
    },
    {
      email: 'qa2@arab-annotators.com',
      password: 'QA_Reviewer#2024@',
      full_name: 'مراجع الجودة الثاني',
      role: 'qa',
    },
    {
      email: 'tasker1@arab-annotators.com',
      password: 'Tasker#2024_01!',
      full_name: 'المُشغِّل الأول',
      role: 'tasker',
    },
    {
      email: 'tasker2@arab-annotators.com',
      password: 'Tasker#2024_02!',
      full_name: 'المُشغِّل الثاني',
      role: 'tasker',
    },
    {
      email: 'tasker3@arab-annotators.com',
      password: 'Tasker#2024_03!',
      full_name: 'المُشغِّل الثالث',
      role: 'tasker',
    },
    {
      email: 'tasker4@arab-annotators.com',
      password: 'Tasker#2024_04!',
      full_name: 'المُشغِّل الرابع',
      role: 'tasker',
    },
    {
      email: 'tasker5@arab-annotators.com',
      password: 'Tasker#2024_05!',
      full_name: 'المُشغِّل الخامس',
      role: 'tasker',
    },
  ]

  const results = []
  const errors = []

  for (const u of users) {
    try {
      // Use maybeSingle() — returns null instead of error when row doesn't exist
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('email', u.email)
        .maybeSingle()

      if (existing) {
        results.push({ email: u.email, status: 'already_exists' })
        continue
      }

      // Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      })

      if (authError) {
        // User might exist in auth but not profiles — try to find them
        if (authError.message?.includes('already been registered')) {
          results.push({ email: u.email, status: 'auth_exists_profile_missing' })
        } else {
          errors.push({ email: u.email, error: authError.message })
        }
        continue
      }

      // Create profile
      const { error: profileError } = await admin.from('profiles').upsert({
        id: authData.user.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        errors.push({ email: u.email, error: 'Profile upsert failed: ' + profileError.message })
        continue
      }

      results.push({ email: u.email, role: u.role, status: 'created' })

    } catch (e) {
      errors.push({ email: u.email, error: e.message })
    }
  }

  return res.status(200).json({
    message: 'Seed completed',
    summary: {
      created: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'already_exists').length,
      failed: errors.length,
    },
    results,
    errors,
    // Return credentials only on first successful run for security
    credentials: errors.length === 0
      ? users.map(u => ({ email: u.email, password: u.password, role: u.role }))
      : 'Fix errors above first',
  })
}
