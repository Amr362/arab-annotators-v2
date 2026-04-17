import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useProfile } from '../../components/ProfileProvider'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS } from '../../lib/auth'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const ROLES = ['tasker', 'qa', 'admin']
const ROLE_COLORS = {
  super_admin: '#f0a500',
  admin: '#58a6ff',
  qa: '#bc8cff',
  tasker: '#3fb950',
}

export default function AdminUsers() {
  const { profile: currentProfile } = useProfile()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'tasker' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function handleSaveUser() {
    if (!form.email || !form.full_name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    if (!editingUser && !form.password) {
      toast.error('يرجى إدخال كلمة المرور للمستخدم الجديد')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/manage', {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId: editingUser?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')

      toast.success(editingUser ? 'تم تحديث المستخدم' : 'تم إنشاء المستخدم بنجاح')
      setShowModal(false)
      setEditingUser(null)
      setForm({ email: '', full_name: '', password: '', role: 'tasker' })
      fetchUsers()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(user) {
    if (user.role === 'super_admin') {
      toast.error('لا يمكن تعطيل حساب السوبر أدمن')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) {
      toast.error('حدث خطأ')
    } else {
      toast.success(user.is_active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
      fetchUsers()
    }
  }

  async function handleChangeRole(userId, newRole, userRole) {
    if (userRole === 'super_admin') {
      toast.error('لا يمكن تغيير دور السوبر أدمن')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) toast.error('حدث خطأ')
    else { toast.success('تم تغيير الدور'); fetchUsers() }
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({ email: user.email, full_name: user.full_name || '', password: '', role: user.role })
    setShowModal(true)
  }

  return (
    <Layout title="إدارة المستخدمين" requireRole={['super_admin', 'admin']}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', direction: 'rtl', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>إدارة المستخدمين</h1>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
            {users.length} مستخدم مسجّل
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setForm({ email: '', full_name: '', password: '', role: 'tasker' }); setShowModal(true) }}
          className="btn-primary"
        >
          <span>＋</span><span>إضافة مستخدم</span>
        </button>
      </div>

      {/* Role stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { role: 'super_admin', label: 'سوبر أدمن' },
          { role: 'admin', label: 'أدمن' },
          { role: 'qa', label: 'مراجعو QA' },
          { role: 'tasker', label: 'مُشغِّلون' },
        ].map(item => {
          const count = users.filter(u => u.role === item.role).length
          return (
            <div key={item.role} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              background: '#21262d',
              border: `1px solid ${ROLE_COLORS[item.role]}30`,
              borderRadius: '8px',
            }}>
              <span style={{ color: ROLE_COLORS[item.role], fontSize: '12px' }}>◉</span>
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>{item.label}</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', fontWeight: '700', color: ROLE_COLORS[item.role] }}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="البحث بالاسم أو البريد..."
          className="input-field"
          style={{ maxWidth: '320px', direction: 'rtl' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ direction: 'rtl' }}>المستخدم</th>
                <th style={{ direction: 'rtl' }}>الدور</th>
                <th style={{ direction: 'rtl' }}>الحالة</th>
                <th style={{ direction: 'rtl' }}>تاريخ الانضمام</th>
                <th style={{ direction: 'rtl' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td style={{ direction: 'rtl' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', direction: 'rtl' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: `${ROLE_COLORS[user.role] || '#8b949e'}20`,
                        border: `2px solid ${ROLE_COLORS[user.role] || '#8b949e'}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Cairo, sans-serif',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: ROLE_COLORS[user.role] || '#8b949e',
                        flexShrink: 0,
                      }}>
                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '600', color: '#e6edf3' }}>
                          {user.full_name || '—'}
                          {user.role === 'super_admin' && (
                            <span style={{ marginRight: '6px', fontSize: '10px', color: '#f0a500', background: 'rgba(240,165,0,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                              SUPER
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#8b949e' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.role === 'super_admin' ? (
                      <span style={{
                        display: 'inline-flex', padding: '3px 10px', borderRadius: '20px',
                        background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)',
                        color: '#f0a500', fontSize: '12px', fontFamily: 'Cairo, sans-serif', fontWeight: '600',
                      }}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        onChange={e => handleChangeRole(user.id, e.target.value, user.role)}
                        style={{
                          padding: '4px 10px',
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: '6px',
                          color: ROLE_COLORS[user.role] || '#8b949e',
                          fontFamily: 'Cairo, sans-serif',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        disabled={currentProfile?.role !== 'super_admin' && user.role === 'admin'}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={user.role === 'super_admin'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: 'none',
                        cursor: user.role === 'super_admin' ? 'default' : 'pointer',
                        fontFamily: 'Cairo, sans-serif',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: user.is_active ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                        color: user.is_active ? '#3fb950' : '#f85149',
                      }}
                    >
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.is_active ? '#3fb950' : '#f85149' }} />
                      {user.is_active ? 'نشط' : 'معطّل'}
                    </button>
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#8b949e' }}>
                    {format(new Date(user.created_at), 'dd MMM yyyy', { locale: ar })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEdit(user)}
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                        disabled={user.role === 'super_admin' && currentProfile?.role !== 'super_admin'}
                      >
                        تعديل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '28px',
            width: '440px',
            maxWidth: '90vw',
            direction: 'rtl',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <h3 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '18px', fontWeight: '700', color: '#e6edf3', marginBottom: '24px' }}>
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h3>

            {[
              { label: 'الاسم الكامل *', key: 'full_name', type: 'text', placeholder: 'محمد أحمد', dir: 'rtl' },
              { label: 'البريد الإلكتروني *', key: 'email', type: 'email', placeholder: 'user@example.com', dir: 'ltr', disabled: !!editingUser },
              { label: `كلمة المرور ${editingUser ? '(اتركها فارغة للإبقاء)' : '*'}`, key: 'password', type: 'password', placeholder: '••••••••', dir: 'ltr' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '6px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  className="input-field"
                  style={{ direction: field.dir, textAlign: field.dir === 'ltr' ? 'left' : 'right', opacity: field.disabled ? 0.6 : 1 }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '6px' }}>
                الدور
              </label>
              <select
                value={form.role}
                onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                className="input-field"
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="btn-primary"
                style={{ padding: '10px 24px' }}
              >
                {saving ? 'جاري الحفظ...' : (editingUser ? 'تحديث' : 'إنشاء')}
              </button>
              <button
                onClick={() => { setShowModal(false); setEditingUser(null) }}
                className="btn-secondary"
                style={{ padding: '10px 24px' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
