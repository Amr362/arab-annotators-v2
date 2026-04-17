/**
 * Health check endpoint — call this to diagnose Supabase connection on Vercel
 * GET /api/health
 *
 * Returns the status of every required env var and DB connection.
 * Safe to call publicly — no sensitive data exposed.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    checks: {},
  }

  // ── 1. Environment variables ──────────────────────────────────────────────
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SETUP_SECRET_KEY: process.env.SETUP_SECRET_KEY,
  }

  results.checks.env_vars = {}
  let envOk = true

  for (const [key, val] of Object.entries(envVars)) {
    const exists = !!val && val.trim().length > 0
    const isPublic = key.startsWith('NEXT_PUBLIC_')
    results.checks.env_vars[key] = {
      set: exists,
      // For public keys, show first 20 chars. For private keys, just show length.
      preview: exists
        ? (isPublic ? val.substring(0, 24) + '...' : `[set, length=${val.length}]`)
        : '[MISSING]',
    }
    if (!exists) envOk = false
  }

  results.checks.env_vars._all_set = envOk

  // ── 2. Supabase URL format check ──────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  results.checks.url_format = {
    ok: url.startsWith('https://') && url.includes('.supabase.co'),
    value: url ? url.substring(0, 30) + '...' : '[MISSING]',
    expected_format: 'https://xxxxxxxxxxxx.supabase.co',
  }

  // ── 3. Supabase DB connection test ────────────────────────────────────────
  if (envOk) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      )

      // Lightweight query — just check profiles table exists
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .limit(1)

      if (error) {
        results.checks.db_connection = {
          ok: false,
          error: error.message,
          hint: error.message.includes('relation "public.profiles" does not exist')
            ? 'Run supabase/schema.sql in your Supabase SQL Editor first!'
            : error.message.includes('Invalid API key')
            ? 'SUPABASE_SERVICE_ROLE_KEY is wrong — copy it from Supabase → Settings → API'
            : 'Check your Supabase project is active and not paused',
        }
      } else {
        results.checks.db_connection = {
          ok: true,
          rows_found: data?.length || 0,
        }
      }

      // Check tables exist
      const tables = ['profiles', 'tasks', 'annotations', 'reviews', 'audit_log']
      results.checks.tables = {}

      for (const table of tables) {
        const { error: tErr } = await client.from(table).select('id').limit(1)
        results.checks.tables[table] = {
          ok: !tErr,
          error: tErr?.message || null,
        }
      }

    } catch (e) {
      results.checks.db_connection = {
        ok: false,
        error: e.message,
        hint: 'Unexpected error — check Vercel function logs',
      }
    }
  } else {
    results.checks.db_connection = {
      ok: false,
      error: 'Skipped — env vars missing',
      hint: 'Add all 4 env vars in Vercel → Project Settings → Environment Variables',
    }
  }

  // ── 4. Overall status ────────────────────────────────────────────────────
  const allOk = envOk &&
    results.checks.url_format?.ok &&
    results.checks.db_connection?.ok

  results.status = allOk ? 'healthy' : 'unhealthy'
  results.action_required = allOk
    ? null
    : !envOk
    ? 'Add missing env vars in Vercel dashboard'
    : !results.checks.url_format?.ok
    ? 'Fix NEXT_PUBLIC_SUPABASE_URL format'
    : 'Fix database connection (see db_connection.hint)'

  return res.status(allOk ? 200 : 503).json(results)
}
