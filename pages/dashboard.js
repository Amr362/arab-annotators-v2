import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import { useProfile } from '../components/ProfileProvider'
import { supabase } from '../lib/supabase'
import { isAdmin, isQA } from '../lib/auth'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function Dashboard() {
  const { profile } = useProfile()
  const [stats, setStats] = useState(null)
  const [recentTasks, setRecentTasks] = useState([])
  const [queueStats, setQueueStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch tasks based on role
      let tasksQuery = supabase.from('tasks').select(`
        *,
        assigned_profile:assigned_to(full_name, email),
        annotations(id, submitted_at),
        reviews(id, status)
      `)

      if (profile.role === 'tasker') {
        tasksQuery = tasksQuery.eq('assigned_to', profile.id)
      }

      const { data: tasks } = await tasksQuery.order('created_at', { ascending: false }).limit(20)

      // Compute stats
      const allTasks = tasks || []
      const statsData = {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        in_progress: allTasks.filter(t => t.status === 'in_progress').length,
        submitted: allTasks.filter(t => t.status === 'submitted').length,
        approved: allTasks.filter(t => t.status === 'approved').length,
        rejected: allTasks.filter(t => t.status === 'rejected').length,
      }

      setStats(statsData)
      setRecentTasks(allTasks.slice(0, 8))

      // For taskers: also fetch queue stats from distribution system
      if (profile.role === 'tasker') {
        try {
          const qRes = await fetch('/api/worker/my-tasks?limit=1')
          if (qRes.ok) {
            const qData = await qRes.json()
            setQueueStats(qData.queue_stats || null)
          }
        } catch {}
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  }

  return (
    <Layout title="لوحة التحكم">
      {/* Greeting */}
      <div style={{ marginBottom: '32px', direction: 'rtl' }}>
        <h1 style={{
          fontFamily: 'Cairo, sans-serif',
          fontSize: '28px',
          fontWeight: '700',
          color: '#e6edf3',
          marginBottom: '6px',
        }}>
          {greeting()}، {profile?.full_name?.split(' ')[0] || 'مستخدم'} 👋
        </h1>
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#8b949e' }}>
          إليك نظرة عامة على نشاطك اليوم
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}>
            <StatCard icon="▤" label="إجمالي المهام" value={stats?.total || 0} color="#58a6ff" />
            <StatCard icon="◐" label="معلقة" value={stats?.pending || 0} color="#e3b341" />
            <StatCard icon="◑" label="قيد التنفيذ" value={stats?.in_progress || 0} color="#58a6ff" />
            <StatCard icon="◒" label="مُرسَلة للمراجعة" value={stats?.submitted || 0} color="#bc8cff" />
            <StatCard icon="◕" label="موافق عليها" value={stats?.approved || 0} color="#3fb950" />
            <StatCard icon="◔" label="مرفوضة" value={stats?.rejected || 0} color="#f85149" />
          </div>

          {/* Queue Stats Banner — tasker only */}
          {profile?.role === 'tasker' && queueStats && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(63,185,80,0.06), rgba(88,166,255,0.06))',
              border: '1px solid rgba(63,185,80,0.2)',
              borderRadius: '10px',
              padding: '18px 22px',
              marginBottom: '28px',
              direction: 'rtl',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <div>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3', marginBottom: '4px' }}>
                  طابور مهامك
                </div>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'معلق', val: queueStats.pending, color: '#e3b341' },
                    { label: 'قيد التنفيذ', val: queueStats.in_progress, color: '#58a6ff' },
                    { label: 'مكتمل', val: queueStats.completed, color: '#3fb950' },
                    { label: 'الإجمالي', val: queueStats.total, color: '#8b949e' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: '700', color: s.color }}>{s.val}</span>
                      <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
                {queueStats.total > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ height: '4px', background: '#161b22', borderRadius: '2px', width: '260px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '2px',
                        background: 'linear-gradient(90deg, #3fb950, #58a6ff)',
                        width: `${Math.round((queueStats.completed / queueStats.total) * 100)}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginTop: '4px', display: 'block' }}>
                      {Math.round((queueStats.completed / queueStats.total) * 100)}% مكتمل
                    </span>
                  </div>
                )}
              </div>
              <Link href="/tasks/queue">
                <button className="btn-primary" style={{ flexShrink: 0 }}>
                  {queueStats.pending > 0 ? '▶ ابدأ المهمة التالية' : '☰ عرض الطابور'}
                </button>
              </Link>
            </div>
          )}

          {/* Completion rate */}
          {stats?.total > 0 && (
            <div style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '32px',
              direction: 'rtl',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '600', color: '#e6edf3' }}>
                  معدل الإنجاز الكلي
                </span>
                <span style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#f0a500',
                }}>
                  {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%` }}
                />
              </div>
              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '12px',
                flexWrap: 'wrap',
              }}>
                {[
                  { label: 'موافق', count: stats.approved, color: '#3fb950' },
                  { label: 'مرفوض', count: stats.rejected, color: '#f85149' },
                  { label: 'معلق', count: stats.pending + stats.in_progress + stats.submitted, color: '#8b949e' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
                      {item.label}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent tasks */}
          <div style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #30363d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              direction: 'rtl',
            }}>
              <h2 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: '600', color: '#e6edf3' }}>
                آخر المهام
              </h2>
              <Link href={profile?.role === 'qa' ? '/review' : '/tasks'}>
                <span style={{
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: '13px',
                  color: '#f0a500',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}>
                  عرض الكل ←
                </span>
              </Link>
            </div>

            {recentTasks.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', direction: 'rtl' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#8b949e' }}>
                  لا توجد مهام حالياً
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right', direction: 'rtl' }}>المهمة</th>
                    <th style={{ textAlign: 'right', direction: 'rtl' }}>الحالة</th>
                    {isAdmin(profile) && <th style={{ textAlign: 'right', direction: 'rtl' }}>المُشغِّل</th>}
                    <th style={{ textAlign: 'right', direction: 'rtl' }}>التاريخ</th>
                    <th style={{ textAlign: 'right', direction: 'rtl' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map(task => (
                    <tr key={task.id}>
                      <td style={{ direction: 'rtl', maxWidth: '300px' }}>
                        <div style={{
                          fontFamily: 'Cairo, sans-serif',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#e6edf3',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {task.proverb || 'مهمة بدون عنوان'}
                        </div>
                      </td>
                      <td><StatusBadge status={task.status} /></td>
                      {isAdmin(profile) && (
                        <td style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', direction: 'rtl' }}>
                          {task.assigned_profile?.full_name || task.assigned_profile?.email || '—'}
                        </td>
                      )}
                      <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#8b949e' }}>
                        {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
                      </td>
                      <td>
                        <Link
                          href={
                            (task.status === 'submitted' || task.status === 'needs_revision') && isQA(profile)
                              ? `/review/${task.id}`
                              : `/tasks/${task.id}`
                          }
                        >
                          <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                            فتح
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
