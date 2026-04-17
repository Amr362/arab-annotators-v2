import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getAdminClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Authenticate the requesting user via Pages Router client ──────────────
  let supabaseServer
  try {
    supabaseServer = createPagesServerClient({ req, res })
  } catch (e) {
    return res.status(500).json({ error: 'Auth client initialization failed: ' + e.message })
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized — please log in first' })
  }

  // ── Get admin client (service role) ───────────────────────────────────────
  let admin
  try {
    admin = getAdminClient()
  } catch (e) {
    return res.status(500).json({ error: 'Server configuration error: ' + e.message })
  }

  // ── Verify requester's role ────────────────────────────────────────────────
  const { data: requesterProfile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr || !requesterProfile) {
    return res.status(403).json({ error: 'Profile not found' })
  }

  if (!['super_admin', 'admin'].includes(requesterProfile.role)) {
    return res.status(403).json({ error: 'Forbidden: admin access required' })
  }

  // ════════════════════════════════════════════════════════════════════
  // POST — Create new user
  // ════════════════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    const { email, full_name, password, role = 'tasker' } = req.body || {}

    if (!email || !full_name || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني والاسم وكلمة المرور مطلوبة' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    }
    if (role === 'super_admin') {
      return res.status(403).json({ error: 'لا يمكن إنشاء حساب سوبر أدمن عبر API' })
    }
    if (role === 'admin' && requesterProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'فقط السوبر أدمن يمكنه إنشاء حسابات أدمن' })
    }

    // Create auth user
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    })

    if (createError) {
      return res.status(400).json({ error: createError.message })
    }

    // Create profile record
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      // Rollback: delete the auth user we just created
      await admin.auth.admin.deleteUser(authData.user.id).catch(() => {})
      return res.status(500).json({ error: 'Profile creation failed: ' + profileError.message })
    }

    // Audit log (best effort — don't fail request if this fails)
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'create_user',
      table_name: 'profiles',
      record_id: authData.user.id,
      new_data: { email, full_name, role },
    }).then(() => {}).catch((e) => console.warn('[audit_log]', e.message))

    return res.status(201).json({
      message: 'تم إنشاء المستخدم بنجاح',
      userId: authData.user.id,
    })
  }

  // ════════════════════════════════════════════════════════════════════
  // PUT — Update existing user
  // ════════════════════════════════════════════════════════════════════
  if (req.method === 'PUT') {
    const { userId, full_name, password, role } = req.body || {}

    if (!userId) {
      return res.status(400).json({ error: 'userId مطلوب' })
    }

    // Get the target user's current profile
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single()

    if (targetErr || !target) {
      return res.status(404).json({ error: 'المستخدم غير موجود' })
    }

    // Protect super_admin from being modified by non-super_admins
    if (target.role === 'super_admin' && requesterProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'لا يمكن تعديل حساب السوبر أدمن' })
    }

    // Update password if provided
    if (password && password.trim().length >= 8) {
      const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
        password: password.trim(),
      })
      if (pwError) {
        return res.status(400).json({ error: 'فشل تحديث كلمة المرور: ' + pwError.message })
      }
    }

    // Build profile updates
    const updates = { updated_at: new Date().toISOString() }

    if (full_name && full_name.trim()) {
      updates.full_name = full_name.trim()
    }

    if (role && role !== target.role) {
      if (role === 'super_admin') {
        return res.status(403).json({ error: 'لا يمكن ترقية مستخدم إلى سوبر أدمن' })
      }
      if (target.role !== 'super_admin') {
        updates.role = role
      }
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (updateError) {
      return res.status(500).json({ error: 'فشل التحديث: ' + updateError.message })
    }

    // Audit log (best effort)
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'update_user',
      table_name: 'profiles',
      record_id: userId,
      new_data: updates,
    }).then(() => {}).catch((e) => console.warn('[audit_log]', e.message))

    return res.status(200).json({ message: 'تم تحديث المستخدم بنجاح' })
  }
}
