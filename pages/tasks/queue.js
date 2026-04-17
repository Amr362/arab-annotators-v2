/**
 * /pages/tasks/queue.js
 * Worker's personal queue view — shows tasks in order with next-task button
 */
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useProfile } from '../../components/ProfileProvider'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import toast from 'react-hot-toast'

function QueueStatCard({ label, value, color = '#f0a500' }) {
  return (
    <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', textAlign: 'center', direction: 'rtl' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

export default function WorkerQueue() {
  const { profile } = useProfile()
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pullingNext, setPullingNext] = useState(false)
  const [filter, setFilter] = useState('all')
  const [offset, setOffset] = useState(0)

  const LIMIT = 25

  useEffect(() => { if (profile) fetchQueue() }, [profile, filter, offset])

  async function fetchQueue() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: filter, limit: LIMIT, offset })
      const res = await fetch(`/api/worker/my-tasks?${params}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'خطأ في جلب المهام'); return }
      setTasks(data.tasks || [])
      setStats(data.queue_stats)
      setPagination(data.pagination)
    } catch (e) {
      toast.error('خطأ في الاتصال: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePullNext() {
    setPullingNext(true)
    try {
      const res = await fetch('/api/worker/next-task')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'خطأ'); return }

      if (!data.task) {
        toast('طابور المهام فارغ — لا توجد مهام جديدة', { icon: '📭' })
        return
      }

      toast.success('تم سحب المهمة — انتقل إليها الآن')
      // Navigate to the task workspace
      window.location.href = `/tasks/${data.task.task_id}`
    } finally {
      setPullingNext(false)
    }
  }

  const statusFilters = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
  ]

  return (
    <Layout title="طابور مهامي" requireRole={['super_admin', 'admin', 'tasker']}>
      <div style={{ direction: 'rtl' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>طابور مهامي</h1>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>مهامك مرتبة بالأولوية — ابدأ من الأعلى</p>
          </div>
          <button
            onClick={handlePullNext}
            disabled={pullingNext || stats?.pending === 0}
            className="btn-primary"
            style={{ opacity: (pullingNext || stats?.pending === 0) ? 0.5 : 1 }}
          >
            {pullingNext
              ? <><div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#0d1117' }} /><span>جاري...</span></>
              : <><span>▶</span><span>ابدأ المهمة التالية</span></>
            }
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <QueueStatCard label="إجمالي المعين" value={stats.total} color="#f0a500" />
            <QueueStatCard label="معلق" value={stats.pending} color="#e3b341" />
            <QueueStatCard label="قيد التنفيذ" value={stats.in_progress} color="#58a6ff" />
            <QueueStatCard label="مكتمل" value={stats.completed} color="#3fb950" />
          </div>
        )}

        {/* Progress bar */}
        {stats && stats.total > 0 && (
          <div style={{ marginBottom: '20px', background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>تقدمك الكلي</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#3fb950', fontWeight: '700' }}>
                {Math.round((stats.completed / stats.total) * 100)}%
              </span>
            </div>
            <div style={{ height: '6px', background: '#161b22', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '3px', transition: 'width 0.4s ease',
                background: 'linear-gradient(90deg, #3fb950, #58a6ff)',
                width: `${(stats.completed / stats.total) * 100}%`,
              }} />
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', background: '#161b22', borderRadius: '8px', padding: '4px', border: '1px solid #30363d', width: 'fit-content' }}>
          {statusFilters.map(f => (
            <button key={f.value} onClick={() => { setFilter(f.value); setOffset(0) }} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none',
              fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer',
              background: filter === f.value ? '#30363d' : 'transparent',
              color: filter === f.value ? '#e6edf3' : '#8b949e',
              fontWeight: filter === f.value ? '600' : '400',
              transition: 'all 0.15s',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
            <div className="spinner" style={{ width: '28px', height: '28px' }} />
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#484f58' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px' }}>
              {filter === 'all' ? 'لا توجد مهام معينة لك بعد' : `لا توجد مهام بحالة "${filter}"`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((item, i) => {
              const task = item.task || {}
              const isNext = item.status === 'pending' && i === tasks.findIndex(t => t.status === 'pending')
              return (
                <div key={item.id} style={{
                  background: '#21262d',
                  border: `1px solid ${isNext ? 'rgba(240,165,0,0.4)' : '#30363d'}`,
                  borderRadius: '8px', padding: '16px',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  transition: 'border-color 0.15s',
                }}>
                  {/* Queue position */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: isNext ? 'rgba(240,165,0,0.15)' : '#161b22',
                    border: `2px solid ${isNext ? '#f0a500' : '#30363d'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: '700',
                    color: isNext ? '#f0a500' : '#484f58',
                  }}>
                    {item.queue_position}
                  </div>

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '600', color: '#e6edf3', marginBottom: '4px', direction: 'rtl' }}>
                      {task.proverb || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge status={item.status} size="sm" />
                      {item.assigned_at && (
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
                          {format(new Date(item.assigned_at), 'dd MMM', { locale: ar })}
                        </span>
                      )}
                      {item.completed_at && (
                        <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#3fb950' }}>
                          ✓ أُكمل {format(new Date(item.completed_at), 'dd MMM HH:mm', { locale: ar })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {['pending', 'in_progress'].includes(item.status) ? (
                    <Link href={`/tasks/${item.task_id}`}>
                      <button className={isNext ? 'btn-primary' : 'btn-secondary'} style={{ flexShrink: 0 }}>
                        {isNext ? '▶ ابدأ' : 'فتح'}
                      </button>
                    </Link>
                  ) : item.status === 'completed' ? (
                    <Link href={`/tasks/${item.task_id}`}>
                      <button className="btn-secondary" style={{ flexShrink: 0, fontSize: '12px' }}>عرض</button>
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && (pagination.has_more || offset > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
            {offset > 0 && (
              <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="btn-secondary">
                ‹ السابق
              </button>
            )}
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', display: 'flex', alignItems: 'center' }}>
              {offset + 1} — {Math.min(offset + LIMIT, pagination.total)} من {pagination.total}
            </span>
            {pagination.has_more && (
              <button onClick={() => setOffset(offset + LIMIT)} className="btn-secondary">
                التالي ›
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
