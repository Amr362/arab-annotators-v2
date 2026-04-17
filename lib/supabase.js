import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate at module load — gives clear error in logs instead of cryptic crash
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    '[Arab Annotators] Missing Supabase env vars.\n' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local or Vercel dashboard.'
  )
}

// ── Client-side singleton ──────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'arab-annotators-auth',
  },
  global: {
    headers: { 'x-app-name': 'arab-annotators' },
  },
})

// ── Server-side admin singleton (service role — never expose to client) ────────
let _adminClient = null

export function getAdminClient() {
  // Re-use existing instance (fixes memory leak in API routes)
  if (_adminClient) return _adminClient

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceRoleKey || !url) {
    throw new Error(
      '[Arab Annotators] Missing server env vars: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL.\n' +
      'Add them to your .env.local and Vercel Project Settings → Environment Variables.'
    )
  }

  _adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-app-name': 'arab-annotators-admin' },
    },
  })

  return _adminClient
}

// ── Helper: safe async wrapper ─────────────────────────────────────────────────
export async function safeQuery(queryFn) {
  try {
    const result = await queryFn()
    if (result.error) throw result.error
    return { data: result.data, error: null }
  } catch (error) {
    console.error('[Supabase Query Error]', error.message)
    return { data: null, error }
  }
}
