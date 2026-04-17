import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../components/ProfileProvider'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function AdminTasks() {
  const { profile } = useProfile()
  const [tasks, setTasks] = useState([])
  const [taskers, setTaskers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTasker, setFilterTasker] = useState('all')

  const [form, setForm] = useState({
    proverb: '',
    context_sentence_1: '',
    context_sentence_2: '',
    context_sentence_3: '',
    assigned_to: '',
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: taskData }, { data: taskerData }] = await Promise.all([
      supabase.from('tasks').select(`
        *,
        assigned_profile:assigned_to(full_name, email),
        annotations(id, submitted_at),
        reviews(id, status)
      `).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email, role').in('role', ['tasker', 'admin', 'super_admin']),
    ])
    setTasks(taskData || [])
    setTaskers(taskerData || [])
    setLoading(false)
  }

  async function handleCreateTask() {
    if (!form.proverb.trim() || !form.context_sentence_1.trim() || !form.context_sentence_2.trim() || !form.context_sentence_3.trim()) {
      toast.error('يرجى ملء المثل والجمل الثلاث')
      return
    }
    setSaving(true)
    try {
      const userId = profile?.id
      if (!userId) throw new Error('غير مصرح')
      const payload = {
        proverb: form.proverb.trim(),
        context_sentences: [
          form.context_sentence_1.trim(),
          form.context_sentence_2.trim(),
          form.context_sentence_3.trim(),
        ],
        assigned_to: form.assigned_to || null,
        status: form.assigned_to ? 'pending' : 'pending',
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('tasks').insert(payload)
      if (error) throw error

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'create_task',
        table_name: 'tasks',
        new_data: payload,
      })

      toast.success('تم إنشاء المهمة بنجاح')
      setShowModal(false)
      setForm({ proverb: '', context_sentence_1: '', context_sentence_2: '', context_sentence_3: '', assigned_to: '' })
      fetchAll()
    } catch (e) {
      toast.error('حدث خطأ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign(taskId, taskerId) {
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_to: taskerId || null, status: taskerId ? 'pending' : 'pending', updated_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) toast.error('حدث خطأ في التعيين')
    else { toast.success('تم تعيين المهمة'); fetchAll() }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) toast.error('حدث خطأ في الحذف')
    else { toast.success('تم حذف المهمة'); fetchAll() }
  }

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterTasker !== 'all' && t.assigned_to !== filterTasker) return false
    return true
  })

  const STATUS_OPTS = ['all', 'pending', 'in_progress', 'submitted', 'approved', 'rejected']
  const STATUS_LABELS = { all: 'الكل', pending: 'معلق', in_progress: 'قيد التنفيذ', submitted: 'مُرسَل', approved: 'موافق', rejected: 'مرفوض' }

  return (
    <Layout title="إدارة المهام" requireRole={['super_admin', 'admin']}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', direction: 'rtl', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>إدارة المهام</h1>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
            {filtered.length} من {tasks.length} مهمة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/distribution">
            <button className="btn-secondary">
              <span>◉</span><span>التوزيع</span>
            </button>
          </Link>
          <Link href="/admin/bulk-upload">
            <button className="btn-secondary">
              <span>⬆</span><span>رفع بالجملة</span>
            </button>
          </Link>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <span>＋</span><span>مهمة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer' }}
        >
          {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>

        <select
          value={filterTasker}
          onChange={e => setFilterTasker(e.target.value)}
          style={{ padding: '8px 12px', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer' }}
        >
          <option value="all">كل المُشغِّلين</option>
          {taskers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
        </select>
      </div>

      {/* Tasks table */}
      <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', direction: 'rtl' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ fontFamily: 'Cairo, sans-serif', color: '#8b949e' }}>لا توجد مهام</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ direction: 'rtl' }}>المثل</th>
                <th style={{ direction: 'rtl' }}>الحالة</th>
                <th style={{ direction: 'rtl' }}>المُشغِّل</th>
                <th style={{ direction: 'rtl' }}>الإجابات</th>
                <th style={{ direction: 'rtl' }}>التاريخ</th>
                <th style={{ direction: 'rtl' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const annotationsCount = task.annotations?.length || 0
                return (
                  <tr key={task.id}>
                    <td style={{ maxWidth: '260px', direction: 'rtl' }}>
                      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '600', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.proverb}
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#484f58', marginTop: '2px' }}>
                        #{task.id.slice(0, 8)}
                      </div>
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td style={{ minWidth: '160px' }}>
                      <select
                        value={task.assigned_to || ''}
                        onChange={e => handleAssign(task.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: '6px',
                          color: '#e6edf3',
                          fontFamily: 'Cairo, sans-serif',
                          fontSize: '12px',
                          cursor: 'pointer',
                          maxWidth: '160px',
                        }}
                        disabled={task.status === 'approved'}
                      >
                        <option value="">غير مُعيَّنة</option>
                        {taskers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="progress-bar" style={{ width: '60px' }}>
                          <div className="progress-fill" style={{ width: annotationsCount > 0 ? '100%' : '0%' }} />
                        </div>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#8b949e' }}>
                          {annotationsCount > 0 ? '✓' : '○'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#8b949e' }}>
                      {format(new Date(task.created_at), 'dd MMM', { locale: ar })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link href={`/tasks/${task.id}`}>
                          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>عرض</button>
                        </Link>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          disabled={task.status === 'approved'}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create task modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#21262d', border: '1px solid #30363d', borderRadius: '12px',
            padding: '28px', width: '560px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto',
            direction: 'rtl', animation: 'fadeIn 0.2s ease-out',
          }}>
            <h3 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '18px', fontWeight: '700', color: '#e6edf3', marginBottom: '24px' }}>
              إنشاء مهمة جديدة
            </h3>

            {/* Proverb */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '6px' }}>
                المثل / الحكمة *
              </label>
              <textarea
                value={form.proverb}
                onChange={e => setForm(p => ({ ...p, proverb: e.target.value }))}
                placeholder="أدخل المثل أو الحكمة العربية..."
                className="input-field textarea-arabic"
                rows={3}
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Context sentences */}
            <div style={{ marginBottom: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '700', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              الجمل السياقية الثلاث *
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#484f58', marginBottom: '4px' }}>
                  الجملة {i}
                </label>
                <textarea
                  value={form[`context_sentence_${i}`]}
                  onChange={e => setForm(p => ({ ...p, [`context_sentence_${i}`]: e.target.value }))}
                  placeholder={`أدخل الجملة السياقية ${i}...`}
                  className="input-field textarea-arabic"
                  rows={2}
                />
              </div>
            ))}

            {/* Assign to */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: '#8b949e', marginBottom: '6px' }}>
                تعيين إلى مُشغِّل (اختياري)
              </label>
              <select
                value={form.assigned_to}
                onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                className="input-field"
              >
                <option value="">اختر مُشغِّلاً</option>
                {taskers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleCreateTask} disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>
                {saving ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '10px 24px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
