import { supabase } from './supabase'

// ── Auth actions ───────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// ── Role helpers (pure functions — no async, no network) ────────────────────────

export function hasRole(profile, ...roles) {
  if (!profile) return false
  return roles.includes(profile.role)
}

export function isAdmin(profile) {
  return hasRole(profile, 'super_admin', 'admin')
}

export function isQA(profile) {
  return hasRole(profile, 'super_admin', 'admin', 'qa')
}

export function canAnnotate(profile) {
  return hasRole(profile, 'super_admin', 'admin', 'tasker')
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  QA: 'qa',
  TASKER: 'tasker',
}

export const ROLE_LABELS = {
  super_admin: 'سوبر أدمن',
  admin: 'أدمن',
  qa: 'مراجع QA',
  tasker: 'مُشغِّل',
}

export const STATUS_LABELS = {
  pending: 'معلق',
  in_progress: 'قيد التنفيذ',
  submitted: 'مُرسَل',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  needs_revision: 'يحتاج مراجعة',
}
