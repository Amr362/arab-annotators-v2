import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useProfile } from '../components/ProfileProvider'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/auth'

const ROLE_COLOR = {
  super_admin: '#f0a500',
  admin: '#58a6ff',
  qa: '#bc8cff',
  tasker: '#3fb950',
}

const ACCENT_COLORS = [
  { value: '#f0a500', label: 'ذهبي' },
  { value: '#58a6ff', label: 'أزرق' },
  { value: '#3fb950', label: 'أخضر' },
  { value: '#bc8cff', label: 'بنفسجي' },
  { value: '#f78166', label: 'برتقالي' },
  { value: '#ff7b72', label: 'أحمر' },
]

const TIMEZONES = [
  { value: 'Africa/Cairo',      label: 'القاهرة (GMT+2/+3)' },
  { value: 'Asia/Riyadh',       label: 'الرياض (GMT+3)' },
  { value: 'Asia/Dubai',        label: 'دبي (GMT+4)' },
  { value: 'Asia/Baghdad',      label: 'بغداد (GMT+3)' },
  { value: 'Africa/Casablanca', label: 'الدار البيضاء (GMT+1)' },
  { value: 'Asia/Beirut',       label: 'بيروت (GMT+2/+3)' },
  { value: 'Asia/Amman',        label: 'عمّان (GMT+2/+3)' },
  { value: 'Asia/Kuwait',       label: 'الكويت (GMT+3)' },
  { value: 'Europe/London',     label: 'لندن (GMT+0/+1)' },
  { value: 'Europe/Paris',      label: 'باريس (GMT+1/+2)' },
  { value: 'America/New_York',  label: 'نيويورك (GMT-5/-4)' },
]

const AUTO_SAVE_OPTIONS = [
  { value: 15,  label: 'كل 15 ثانية' },
  { value: 30,  label: 'كل 30 ثانية' },
  { value: 60,  label: 'كل دقيقة' },
  { value: 120, label: 'كل دقيقتين' },
  { value: 300, label: 'كل 5 دقائق' },
]

/* ── Reusable Input ─────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, hint, error, readOnly, suffix }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '20px', direction: 'rtl' }}>
      <label style={{
        display: 'block', fontFamily: 'Cairo, sans-serif',
        fontSize: '13px', fontWeight: '600',
        color: error ? '#f85149' : '#8b949e', marginBottom: '7px',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} onChange={onChange}
          placeholder={placeholder} readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#0d1117',
            border: `1px solid ${error ? '#f85149' : focused ? '#f0a500' : '#30363d'}`,
            borderRadius: '8px',
            padding: suffix ? '10px 42px 10px 12px' : '10px 14px',
            color: readOnly ? '#484f58' : '#e6edf3',
            fontSize: '14px',
            fontFamily: type === 'email' || type === 'password'
              ? 'IBM Plex Mono, monospace' : 'Cairo, sans-serif',
            direction: type === 'email' || type === 'password' ? 'ltr' : 'rtl',
            outline: 'none',
            cursor: readOnly ? 'not-allowed' : 'text',
            boxShadow: focused && !readOnly
              ? `0 0 0 3px ${error ? 'rgba(248,81,73,.1)' : 'rgba(240,165,0,.1)'}` : 'none',
            transition: 'border-color .15s, box-shadow .15s',
          }}
        />
        {suffix && (
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#484f58' }}>
            {suffix}
          </div>
        )}
      </div>
      {hint && !error && (
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '5px' }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f85149', marginTop: '5px' }}>{error}</p>
      )}
    </div>
  )
}

/* ── Toggle Switch ──────────────────────────────────────── */
function Toggle({ label, hint, checked, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid #21262d', direction: 'rtl',
    }}>
      <div style={{ flex: 1, paddingLeft: '16px' }}>
        <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#c9d1d9' }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '3px' }}>
            {hint}
          </div>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
          background: checked ? '#3fb950' : '#30363d',
          position: 'relative', cursor: 'pointer',
          transition: 'background .2s',
          boxShadow: checked ? '0 0 0 3px rgba(63,185,80,.15)' : 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.4)',
        }} />
      </div>
    </div>
  )
}

/* ── Select Field ───────────────────────────────────────── */
function SelectField({ label, value, onChange, options, hint }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '20px', direction: 'rtl' }}>
      <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '7px' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box', background: '#0d1117',
          border: `1px solid ${focused ? '#f0a500' : '#30363d'}`,
          borderRadius: '8px', padding: '10px 14px',
          color: '#e6edf3', fontSize: '14px', fontFamily: 'Cairo, sans-serif', direction: 'rtl',
          outline: 'none', cursor: 'pointer',
          boxShadow: focused ? '0 0 0 3px rgba(240,165,0,.1)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hint && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '5px' }}>{hint}</p>}
    </div>
  )
}

/* ── Number Stepper ─────────────────────────────────────── */
function NumberStepper({ label, hint, value, onChange, min = 1, max = 100, unit }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  const btnStyle = (dis) => ({
    width: '32px', height: '32px', borderRadius: '6px',
    background: dis ? '#0d1117' : '#21262d', border: '1px solid #30363d',
    color: dis ? '#30363d' : '#8b949e', cursor: dis ? 'not-allowed' : 'pointer',
    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background .15s',
  })
  return (
    <div style={{ marginBottom: '20px', direction: 'rtl' }}>
      <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '7px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={dec} disabled={value <= min} style={btnStyle(value <= min)}>−</button>
        <div style={{
          flex: 1, textAlign: 'center', background: '#0d1117', border: '1px solid #30363d',
          borderRadius: '8px', padding: '8px 12px', fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '15px', fontWeight: '700', color: '#f0a500',
        }}>
          {value}{unit && <span style={{ fontSize: '11px', color: '#484f58', marginRight: '4px' }}>{unit}</span>}
        </div>
        <button onClick={inc} disabled={value >= max} style={btnStyle(value >= max)}>+</button>
      </div>
      {hint && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '5px' }}>{hint}</p>}
    </div>
  )
}

/* ── Password Strength ──────────────────────────────────── */
function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8)           score++
  if (password.length >= 12)          score++
  if (/[A-Z]/.test(password))         score++
  if (/[0-9]/.test(password))         score++
  if (/[^A-Za-z0-9]/.test(password))  score++
  const levels = [
    { label: '', color: '#30363d' },
    { label: 'ضعيفة جداً', color: '#f85149' },
    { label: 'ضعيفة', color: '#ffa657' },
    { label: 'مقبولة', color: '#e3b341' },
    { label: 'قوية', color: '#3fb950' },
    { label: 'قوية جداً ✓', color: '#58a6ff' },
  ]
  const { label, color } = levels[Math.min(score, 5)]
  return (
    <div style={{ marginTop: '-12px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= score ? color : '#21262d', transition: 'background .2s' }} />
        ))}
      </div>
      {label && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color, textAlign: 'right' }}>{label}</p>}
    </div>
  )
}

/* ── Alert ──────────────────────────────────────────────── */
function Alert({ type, message }) {
  if (!message) return null
  const styles = {
    success: { bg: 'rgba(63,185,80,.08)',  border: 'rgba(63,185,80,.3)',  color: '#3fb950', icon: '✓' },
    error:   { bg: 'rgba(248,81,73,.08)', border: 'rgba(248,81,73,.3)', color: '#f85149', icon: '✕' },
  }
  const s = styles[type] || styles.error
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '20px', direction: 'rtl' }}>
      <span style={{ color: s.color, fontWeight: '700', fontSize: '14px' }}>{s.icon}</span>
      <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: s.color }}>{message}</span>
    </div>
  )
}

/* ── Section Card ───────────────────────────────────────── */
function Card({ title, subtitle, children, accent }) {
  return (
    <div style={{ background: '#161b22', border: `1px solid ${accent ? 'rgba(248,81,73,.25)' : '#30363d'}`, borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${accent ? 'rgba(248,81,73,.15)' : '#21262d'}`, background: accent ? 'rgba(248,81,73,.03)' : 'transparent' }}>
        <h2 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: '700', color: accent ? '#f85149' : '#e6edf3', margin: 0, direction: 'rtl' }}>{title}</h2>
        {subtitle && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#484f58', margin: '4px 0 0', direction: 'rtl' }}>{subtitle}</p>}
      </div>
      <div style={{ padding: '24px' }}>{children}</div>
    </div>
  )
}

/* ── Btn ────────────────────────────────────────────────── */
function Btn({ onClick, loading, disabled, danger, children, outline }) {
  const [hover, setHover] = useState(false)
  const base = { padding: '9px 22px', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '700', cursor: disabled || loading ? 'not-allowed' : 'pointer', border: 'none', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: disabled || loading ? 0.6 : 1 }
  let bg, color, border
  if (danger) { bg = hover ? 'rgba(248,81,73,.2)' : 'rgba(248,81,73,.1)'; color = '#f85149'; border = '1px solid rgba(248,81,73,.4)' }
  else if (outline) { bg = hover ? '#21262d' : 'transparent'; color = '#8b949e'; border = '1px solid #30363d' }
  else { bg = hover ? 'linear-gradient(135deg,#e09a00,#f0a500)' : 'linear-gradient(135deg,#f0a500,#ffd700)'; color = '#0d1117'; border = 'none' }
  return (
    <button onClick={onClick} disabled={disabled || loading} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...base, background: bg, color, border }}>
      {loading && <div style={{ width: '13px', height: '13px', border: `2px solid ${danger ? '#f85149' : '#0d1117'}33`, borderTopColor: danger ? '#f85149' : '#0d1117', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
      {children}
    </button>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function Settings() {
  const { profile, refresh } = useProfile()

  const [fullName, setFullName]       = useState('')
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoAlert, setInfoAlert]     = useState(null)

  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPws, setShowPws]       = useState({ current: false, new: false, confirm: false })
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwAlert, setPwAlert]       = useState(null)
  const [pwErrors, setPwErrors]     = useState({})

  const [prefs, setPrefs] = useState({
    notifyNewTasks:      true,
    notifyReviewDone:    true,
    notifyEmail:         false,
    language:            'ar',
    timezone:            'Africa/Cairo',
    accentColor:         '#f0a500',
    batchSize:           10,
    autoSave:            true,
    autoSaveInterval:    30,
    confirmBeforeSubmit: true,
  })
  const [prefsSaved, setPrefsSaved] = useState(false)

  const [exportLoading, setExportLoading] = useState(false)
  const [exportAlert, setExportAlert]     = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteAlert, setDeleteAlert]     = useState(null)

  useEffect(() => {
    if (profile) setFullName(profile.full_name || '')
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    try {
      const stored = localStorage.getItem(`prefs_${profile.id}`)
      if (stored) setPrefs(prev => ({ ...prev, ...JSON.parse(stored) }))
    } catch {}
  }, [profile?.id])

  function updatePref(key, value) {
    setPrefs(prev => {
      const updated = { ...prev, [key]: value }
      if (profile?.id) { try { localStorage.setItem(`prefs_${profile.id}`, JSON.stringify(updated)) } catch {} }
      return updated
    })
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 1800)
  }

  async function handleSaveInfo() {
    if (!fullName.trim()) { setInfoAlert({ type: 'error', message: 'الاسم الكامل مطلوب' }); return }
    setInfoLoading(true); setInfoAlert(null)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), updated_at: new Date().toISOString() }).eq('id', profile.id)
      if (error) throw error
      await refresh()
      setInfoAlert({ type: 'success', message: 'تم حفظ البيانات الشخصية بنجاح ✓' })
    } catch (e) {
      setInfoAlert({ type: 'error', message: e.message || 'حدث خطأ أثناء الحفظ' })
    } finally { setInfoLoading(false) }
  }

  async function handleChangePassword() {
    const errors = {}
    if (!currentPw) errors.current = 'أدخل كلمة المرور الحالية'
    if (!newPw || newPw.length < 8) errors.new = 'كلمة المرور الجديدة 8 أحرف على الأقل'
    if (newPw !== confirmPw) errors.confirm = 'كلمتا المرور غير متطابقتان'
    if (newPw === currentPw) errors.new = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية'
    if (Object.keys(errors).length) { setPwErrors(errors); return }
    setPwErrors({}); setPwLoading(true); setPwAlert(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPw })
      if (signInError) { setPwErrors({ current: 'كلمة المرور الحالية غير صحيحة' }); return }
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwAlert({ type: 'success', message: 'تم تغيير كلمة المرور بنجاح ✓' })
    } catch (e) {
      setPwAlert({ type: 'error', message: e.message || 'حدث خطأ أثناء تغيير كلمة المرور' })
    } finally { setPwLoading(false) }
  }

  async function handleExport() {
    setExportLoading(true); setExportAlert(null)
    try {
      const [{ data: annotations }, { data: tasks }] = await Promise.all([
        supabase.from('annotations').select('*').eq('annotator_id', profile.id),
        supabase.from('tasks').select('id, title, status, created_at, updated_at, submitted_at').eq('assigned_to', profile.id),
      ])
      const exportData = {
        profile: { id: profile.id, full_name: profile.full_name, email: profile.email, role: profile.role, created_at: profile.created_at },
        annotations: annotations || [],
        tasks: tasks || [],
        preferences: prefs,
        exportedAt: new Date().toISOString(),
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportAlert({ type: 'success', message: `تم تصدير ${(annotations||[]).length} توسيم و${(tasks||[]).length} مهمة بنجاح ✓` })
    } catch (e) {
      setExportAlert({ type: 'error', message: e.message || 'حدث خطأ أثناء التصدير' })
    } finally { setExportLoading(false) }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'احذف حسابي') { setDeleteAlert({ type: 'error', message: 'اكتب "احذف حسابي" بالظبط للتأكيد' }); return }
    setDeleteLoading(true); setDeleteAlert(null)
    try {
      const res = await fetch('/api/users/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (e) {
      setDeleteAlert({ type: 'error', message: e.message || 'حدث خطأ أثناء حذف الحساب' })
      setDeleteLoading(false)
    }
  }

  function togglePw(field) { setShowPws(p => ({ ...p, [field]: !p[field] })) }

  const EyeBtn = ({ field }) => (
    <button type="button" onClick={() => togglePw(field)} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', padding: '0', display: 'flex' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {showPws[field]
          ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
          : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
        }
      </svg>
    </button>
  )

  if (!profile) return null

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const roleColor = ROLE_COLOR[profile.role] || '#8b949e'

  return (
    <Layout title="إعدادات الحساب">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ marginBottom: '28px', direction: 'rtl' }}>
        <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '800', color: '#e6edf3', margin: '0 0 6px' }}>إعدادات الحساب</h1>
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#484f58', margin: 0 }}>إدارة بياناتك الشخصية وتفضيلاتك وأمان حسابك</p>
      </div>

      {/* Profile Overview */}
      <div style={{ background: 'linear-gradient(135deg, rgba(240,165,0,.04), rgba(240,165,0,.01))', border: '1px solid rgba(240,165,0,.12)', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', direction: 'rtl' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0, background: `${roleColor}20`, border: `2px solid ${roleColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '800', color: roleColor }}>
          {(profile.full_name || profile.email || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '17px', fontWeight: '800', color: '#e6edf3', marginBottom: '4px' }}>{profile.full_name || '—'}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#484f58', marginBottom: '8px' }}>{profile.email}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'Cairo, sans-serif', fontWeight: '700', color: roleColor, background: `${roleColor}15`, border: `1px solid ${roleColor}35` }}>{ROLE_LABELS[profile.role] || profile.role}</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'Cairo, sans-serif', color: profile.is_active ? '#3fb950' : '#f85149', background: profile.is_active ? 'rgba(63,185,80,.1)' : 'rgba(248,81,73,.1)', border: `1px solid ${profile.is_active ? 'rgba(63,185,80,.3)' : 'rgba(248,81,73,.3)'}` }}>{profile.is_active ? '● نشط' : '● موقوف'}</span>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'Cairo, sans-serif', color: '#484f58', background: 'rgba(72,79,88,.1)', border: '1px solid rgba(72,79,88,.3)' }}>انضم {joinDate}</span>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <Card title="البيانات الشخصية" subtitle="تعديل اسمك وبياناتك الأساسية">
        <Alert type={infoAlert?.type} message={infoAlert?.message} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="الاسم الكامل" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="أدخل اسمك الكامل" />
          <Field label="البريد الإلكتروني" type="email" value={profile.email} readOnly hint="لا يمكن تغيير البريد الإلكتروني" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="الدور الوظيفي" value={ROLE_LABELS[profile.role] || profile.role} readOnly hint="يتم التعيين من قبل الإدارة" />
          <Field label="معرّف الحساب" value={profile.id} readOnly />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
          <Btn onClick={handleSaveInfo} loading={infoLoading}>حفظ التغييرات</Btn>
          <Btn outline onClick={() => setFullName(profile.full_name || '')}>إلغاء</Btn>
        </div>
      </Card>

      {/* Change Password */}
      <Card title="تغيير كلمة المرور" subtitle="استخدم كلمة مرور قوية وفريدة">
        <Alert type={pwAlert?.type} message={pwAlert?.message} />
        <div style={{ position: 'relative', marginBottom: '20px', direction: 'rtl' }}>
          <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: pwErrors.current ? '#f85149' : '#8b949e', marginBottom: '7px' }}>كلمة المرور الحالية</label>
          <div style={{ position: 'relative' }}>
            <input type={showPws.current ? 'text' : 'password'} value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwErrors(p => ({ ...p, current: null })) }} placeholder="••••••••" style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: `1px solid ${pwErrors.current ? '#f85149' : '#30363d'}`, borderRadius: '8px', padding: '10px 42px 10px 12px', color: '#e6edf3', fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', direction: 'ltr', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#f0a500'; e.target.style.boxShadow = '0 0 0 3px rgba(240,165,0,.1)' }} onBlur={e => { e.target.style.borderColor = pwErrors.current ? '#f85149' : '#30363d'; e.target.style.boxShadow = 'none' }} />
            <EyeBtn field="current" />
          </div>
          {pwErrors.current && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f85149', marginTop: '5px' }}>{pwErrors.current}</p>}
        </div>
        <div style={{ position: 'relative', marginBottom: '8px', direction: 'rtl' }}>
          <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: pwErrors.new ? '#f85149' : '#8b949e', marginBottom: '7px' }}>كلمة المرور الجديدة</label>
          <div style={{ position: 'relative' }}>
            <input type={showPws.new ? 'text' : 'password'} value={newPw} onChange={e => { setNewPw(e.target.value); setPwErrors(p => ({ ...p, new: null })) }} placeholder="8 أحرف على الأقل" style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: `1px solid ${pwErrors.new ? '#f85149' : '#30363d'}`, borderRadius: '8px', padding: '10px 42px 10px 12px', color: '#e6edf3', fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', direction: 'ltr', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#f0a500'; e.target.style.boxShadow = '0 0 0 3px rgba(240,165,0,.1)' }} onBlur={e => { e.target.style.borderColor = pwErrors.new ? '#f85149' : '#30363d'; e.target.style.boxShadow = 'none' }} />
            <EyeBtn field="new" />
          </div>
          {pwErrors.new && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f85149', marginTop: '5px' }}>{pwErrors.new}</p>}
        </div>
        <PasswordStrength password={newPw} />
        <div style={{ position: 'relative', marginBottom: '20px', direction: 'rtl' }}>
          <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: pwErrors.confirm ? '#f85149' : '#8b949e', marginBottom: '7px' }}>تأكيد كلمة المرور</label>
          <div style={{ position: 'relative' }}>
            <input type={showPws.confirm ? 'text' : 'password'} value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwErrors(p => ({ ...p, confirm: null })) }} placeholder="أعد كتابة كلمة المرور" style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', border: `1px solid ${pwErrors.confirm ? '#f85149' : '#30363d'}`, borderRadius: '8px', padding: '10px 42px 10px 12px', color: '#e6edf3', fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', direction: 'ltr', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#f0a500'; e.target.style.boxShadow = '0 0 0 3px rgba(240,165,0,.1)' }} onBlur={e => { e.target.style.borderColor = pwErrors.confirm ? '#f85149' : '#30363d'; e.target.style.boxShadow = 'none' }} />
            <EyeBtn field="confirm" />
          </div>
          {pwErrors.confirm && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f85149', marginTop: '5px' }}>{pwErrors.confirm}</p>}
          {confirmPw && newPw && confirmPw === newPw && !pwErrors.confirm && <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#3fb950', marginTop: '5px' }}>✓ كلمتا المرور متطابقتان</p>}
        </div>
        <Btn onClick={handleChangePassword} loading={pwLoading}>تحديث كلمة المرور</Btn>
      </Card>

      <ActivitySummary profileId={profile.id} />

      {/* ══ NEW: Notifications ══ */}
      <Card title="🔔 إعدادات الإشعارات" subtitle="تحكم في أي الإشعارات تصلك">
        {prefsSaved && (
          <div style={{ animation: 'fadeIn .3s ease', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', direction: 'rtl' }}>
            <span style={{ color: '#3fb950', fontSize: '12px' }}>✓</span>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#3fb950' }}>تم الحفظ تلقائياً</span>
          </div>
        )}
        <Toggle label="إشعارات المهام الجديدة" hint="تنبيه عند تعيين مهام جديدة لك" checked={prefs.notifyNewTasks} onChange={v => updatePref('notifyNewTasks', v)} />
        <Toggle label="إشعارات انتهاء المراجعة" hint="تنبيه عند الموافقة أو رفض مهامك" checked={prefs.notifyReviewDone} onChange={v => updatePref('notifyReviewDone', v)} />
        <Toggle label="إشعارات البريد الإلكتروني" hint="استقبال ملخص أسبوعي لنشاطك على بريدك" checked={prefs.notifyEmail} onChange={v => updatePref('notifyEmail', v)} />
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '16px', marginBottom: 0, direction: 'rtl' }}>
          ⓘ الإشعارات تُحفظ محلياً — ستطبّق عند دمج نظام Push Notifications
        </p>
      </Card>

      {/* ══ NEW: Language & Timezone ══ */}
      <Card title="🌐 اللغة والمنطقة الزمنية" subtitle="تخصيص لغة الواجهة وتوقيت العرض">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <SelectField label="لغة الواجهة" value={prefs.language} onChange={v => updatePref('language', v)} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} hint="سيتم تطبيق اللغة عند الإصدار القادم" />
          <SelectField label="المنطقة الزمنية" value={prefs.timezone} onChange={v => updatePref('timezone', v)} options={TIMEZONES} hint="تؤثر على عرض تواريخ المهام والتقارير" />
        </div>
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(88,166,255,.05)', border: '1px solid rgba(88,166,255,.15)', direction: 'rtl' }}>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#484f58' }}>الوقت الحالي بتوقيتك: </span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#58a6ff' }}>
            {new Date().toLocaleString('ar-EG', { timeZone: prefs.timezone, hour12: true, hour: '2-digit', minute: '2-digit', weekday: 'long' })}
          </span>
        </div>
      </Card>

      {/* ══ NEW: Theme & Colors ══ */}
      <Card title="🎨 المظهر والألوان" subtitle="تخصيص لون التمييز في الواجهة">
        <div style={{ direction: 'rtl', marginBottom: '20px' }}>
          <label style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', display: 'block', marginBottom: '12px' }}>لون التمييز</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {ACCENT_COLORS.map(({ value, label }) => (
              <div key={value} onClick={() => updatePref('accentColor', value)} title={label} style={{ width: '36px', height: '36px', borderRadius: '50%', background: value, cursor: 'pointer', border: prefs.accentColor === value ? '3px solid #fff' : '3px solid transparent', boxShadow: prefs.accentColor === value ? `0 0 0 2px ${value}, 0 0 12px ${value}60` : 'none', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {prefs.accentColor === value && <span style={{ color: '#0d1117', fontSize: '14px', fontWeight: '900' }}>✓</span>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: `${prefs.accentColor}08`, border: `1px solid ${prefs.accentColor}30`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: prefs.accentColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: prefs.accentColor }}>
              معاينة — {ACCENT_COLORS.find(c => c.value === prefs.accentColor)?.label}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58', marginRight: 'auto' }}>{prefs.accentColor}</span>
          </div>
        </div>
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', direction: 'rtl', margin: 0 }}>
          ⓘ سيُطبَّق اللون على كامل الواجهة في التحديث القادم
        </p>
      </Card>

      {/* ══ NEW: Work Preferences ══ */}
      <Card title="⚙ تفضيلات العمل" subtitle="ضبط سلوك منصة التوسيم أثناء العمل">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <NumberStepper label="حجم الدفعة الواحدة" hint="عدد المهام المعروضة في كل مرة" value={prefs.batchSize} onChange={v => updatePref('batchSize', v)} min={1} max={50} unit="مهمة" />
          <SelectField label="فترة الحفظ التلقائي" value={prefs.autoSaveInterval} onChange={v => updatePref('autoSaveInterval', Number(v))} options={AUTO_SAVE_OPTIONS} hint="يعمل فقط عند تفعيل الحفظ التلقائي" />
        </div>
        <Toggle label="الحفظ التلقائي" hint="حفظ التوسيمات تلقائياً أثناء الكتابة" checked={prefs.autoSave} onChange={v => updatePref('autoSave', v)} />
        <Toggle label="تأكيد قبل التسليم" hint="عرض نافذة تأكيد قبل إرسال أي مهمة" checked={prefs.confirmBeforeSubmit} onChange={v => updatePref('confirmBeforeSubmit', v)} />
        <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(240,165,0,.04)', border: '1px solid rgba(240,165,0,.12)', direction: 'rtl' }}>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#f0a500' }}>✦ الإعدادات النشطة: </span>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
            دفعة {prefs.batchSize} مهمة{prefs.autoSave ? ` · حفظ كل ${prefs.autoSaveInterval}ث` : ' · حفظ يدوي'}{prefs.confirmBeforeSubmit ? ' · تأكيد مفعّل' : ''}
          </span>
        </div>
      </Card>

      {/* ══ NEW: Export Data ══ */}
      <Card title="📤 تصدير بياناتي" subtitle="تحميل نسخة كاملة من بياناتك ونشاطك">
        <Alert type={exportAlert?.type} message={exportAlert?.message} />
        <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(88,166,255,.04)', border: '1px solid rgba(88,166,255,.12)', marginBottom: '20px', direction: 'rtl' }}>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', margin: '0 0 10px' }}>يتضمن الملف المُصدَّر:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {['📋 بياناتك الشخصية', '✏️ جميع التوسيمات', '📌 سجل المهام', '⚙ تفضيلاتك المحفوظة'].map(item => (
              <span key={item} style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#58a6ff' }}>{item}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={handleExport} loading={exportLoading}>
            {!exportLoading && '⬇'} تصدير JSON
          </Btn>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58' }}>ملف JSON · يُفتح في أي محرر نصوص</span>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card title="⚠ منطقة الخطر" subtitle="هذه الإجراءات لا يمكن التراجع عنها" accent>
        <Alert type={deleteAlert?.type} message={deleteAlert?.message} />
        <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(248,81,73,.04)', border: '1px solid rgba(248,81,73,.15)', marginBottom: '20px', direction: 'rtl' }}>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', margin: '0 0 8px' }}>حذف الحساب سيؤدي إلى:</p>
          <ul style={{ margin: 0, padding: '0 16px', listStyle: 'disc' }}>
            {['حذف جميع بياناتك الشخصية نهائياً', 'حذف كل التوسيمات والتعليقات المرتبطة بحسابك', 'لا يمكن استرداد أي بيانات بعد الحذف'].map(item => (
              <li key={item} style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#f85149', marginBottom: '4px' }}>{item}</li>
            ))}
          </ul>
        </div>
        <Field label='اكتب "احذف حسابي" للتأكيد' value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="احذف حسابي" error={deleteAlert?.type === 'error' ? deleteAlert.message : null} />
        <Btn danger onClick={handleDeleteAccount} loading={deleteLoading} disabled={deleteConfirm !== 'احذف حسابي'}>حذف الحساب نهائياً</Btn>
      </Card>
    </Layout>
  )
}

/* ── Activity Summary ───────────────────────────────────── */
function ActivitySummary({ profileId }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { if (profileId) fetchStats() }, [profileId])
  async function fetchStats() {
    try {
      const [{ count: total }, { count: submitted }, { count: approved }] = await Promise.all([
        supabase.from('annotations').select('id', { count: 'exact', head: true }).eq('annotator_id', profileId),
        supabase.from('annotations').select('id', { count: 'exact', head: true }).eq('annotator_id', profileId).not('submitted_at', 'is', null),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', profileId).eq('status', 'approved'),
      ])
      setStats({ total: total || 0, submitted: submitted || 0, approved: approved || 0 })
    } catch {}
  }
  if (!stats) return null
  const items = [
    { label: 'إجمالي التوسيمات', value: stats.total,     color: '#58a6ff' },
    { label: 'توسيمات مُرسَلة',   value: stats.submitted, color: '#f0a500' },
    { label: 'مهام موافق عليها',  value: stats.approved,  color: '#3fb950' },
  ]
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: '700', color: '#e6edf3', margin: '0 0 16px', direction: 'rtl' }}>ملخص النشاط</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{ padding: '16px', borderRadius: '8px', background: `${color}08`, border: `1px solid ${color}20`, textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '26px', fontWeight: '700', color, marginBottom: '4px' }}>{value}</div>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#484f58' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
