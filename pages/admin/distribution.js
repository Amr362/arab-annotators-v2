/**
 * /pages/admin/distribution.js
 * Analytics page: worker performance, batches, assignment health
 */
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import toast from 'react-hot-toast'

function pct(v, t) { return t ? Math.round((v / t) * 100) : 0 }
function scoreColor(s) { return s >= 80 ? '#3fb950' : s >= 50 ? '#f0a500' : '#f85149' }

export default function DistributionAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/distribution-stats')
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'خطأ'); return }
      setData(d)
    } finally {
      setLoading(false)
    }
  }

  async function handleReassign() {
    if (!window.confirm('إعادة توزيع مهام المشغلين غير النشطين (24+ ساعة)؟')) return
    setReassigning(true)
    try {
      const res = await fetch('/api/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inactive_hours: 24 }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'خطأ'); return }
      toast.success(d.message || `تمت إعادة توزيع ${d.reassigned_count} مهمة`)
      fetchStats()
    } finally {
      setReassigning(false)
    }
  }

  if (loading) return (
    <Layout title="توزيع المهام" requireRole={['super_admin', 'admin']}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div className="spinner" style={{ width: '28px', height: '28px' }} />
      </div>
    </Layout>
  )

  const wp = data?.worker_performance || []
  const as = data?.assignment_stats || {}
  const ts = data?.task_stats || {}
  const batches = data?.recent_batches || []

  const totalAssignments = Object.values(as).reduce((s, v) => s + v, 0)

  return (
    <Layout title="توزيع المهام" requireRole={['super_admin', 'admin']}>
      <div style={{ direction: 'rtl' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>تحليلات التوزيع</h1>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
              حالة الطوابير وأداء المشغلين
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={fetchStats} className="btn-secondary">↺ تحديث</button>
            <button onClick={handleReassign} disabled={reassigning} className="btn-primary">
              {reassigning ? '...' : '⚡ إعادة توزيع المعطّلة'}
            </button>
          </div>
        </div>

        {/* Global stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'إجمالي التكليفات', value: totalAssignments, color: '#f0a500' },
            { label: 'معلق', value: as.pending || 0, color: '#e3b341' },
            { label: 'مكتمل', value: as.completed || 0, color: '#3fb950' },
            { label: 'معاد توزيعه', value: as.reassigned || 0, color: '#8b949e' },
          ].map(c => (
            <div key={c.label} style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '26px', fontWeight: '700', color: c.color }}>{c.value}</div>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '4px' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Worker performance table */}
        <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3', marginBottom: '16px' }}>
            🏆 أداء المشغلين
          </div>
          {wp.length === 0 ? (
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#484f58', textAlign: 'center', padding: '20px' }}>
              لا توجد بيانات أداء — ابدأ بتوزيع مهام
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Cairo, sans-serif', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['المشغل', 'المعين', 'المكتمل', 'معدل الإكمال', 'معلق', 'متوسط الوقت (د)', 'آخر نشاط'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', color: '#484f58', fontWeight: '600', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #30363d', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wp.map(w => (
                    <tr key={w.worker_id} style={{ borderBottom: '1px solid rgba(48,54,61,0.5)' }}>
                      <td style={{ padding: '10px 12px', color: '#e6edf3', fontWeight: '500' }}>{w.full_name || w.email}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center' }}>{w.total_assigned}</td>
                      <td style={{ padding: '10px 12px', color: '#3fb950', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', textAlign: 'center' }}>{w.completed}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: '700', color: scoreColor(w.completion_rate || 0), background: `${scoreColor(w.completion_rate || 0)}15`, padding: '2px 8px', borderRadius: '10px', border: `1px solid ${scoreColor(w.completion_rate || 0)}30` }}>
                          {w.completion_rate || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#e3b341', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center' }}>{w.pending}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center' }}>
                        {w.avg_minutes_per_task ? Math.round(w.avg_minutes_per_task) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#484f58', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' }}>
                        {w.last_active_at ? format(new Date(w.last_active_at), 'dd MMM HH:mm', { locale: ar }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent batches */}
        <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3', marginBottom: '16px' }}>
            📦 آخر دفعات الرفع
          </div>
          {batches.length === 0 ? (
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#484f58', textAlign: 'center', padding: '20px' }}>لا توجد دفعات بعد</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {batches.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#161b22', borderRadius: '6px', border: '1px solid #30363d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: b.status === 'completed' ? '#3fb950' : b.status === 'failed' ? '#f85149' : '#f0a500' }}>
                      {b.status === 'completed' ? '✅' : b.status === 'failed' ? '❌' : '⏳'}
                    </span>
                    <div>
                      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#e6edf3' }}>
                        {b.total_tasks} مهمة → {b.total_workers} مشغل
                      </div>
                      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58' }}>
                        {b.tasks_per_worker} مهمة/مشغل أساس
                        {b.remainder_tasks > 0 && ` + ${b.remainder_tasks} إضافية`}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
                    {format(new Date(b.started_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
