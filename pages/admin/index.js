import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS } from '../../lib/auth'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [topPerformers, setTopPerformers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch all tasks
      const { data: tasks } = await supabase.from('tasks').select('id, status, assigned_to, created_at')
      // Fetch all users
      const { data: users } = await supabase.from('profiles').select('id, full_name, email, role, is_active, created_at')
      // Fetch recent audit log
      const { data: logs } = await supabase
        .from('audit_log')
        .select(`*, user_profile:user_id(full_name, email)`)
        .order('created_at', { ascending: false })
        .limit(10)

      const taskList = tasks || []
      const userList = users || []

      setStats({
        totalTasks: taskList.length,
        pendingTasks: taskList.filter(t => t.status === 'pending').length,
        submittedTasks: taskList.filter(t => t.status === 'submitted').length,
        approvedTasks: taskList.filter(t => t.status === 'approved').length,
        rejectedTasks: taskList.filter(t => t.status === 'rejected').length,
        totalUsers: userList.length,
        activeUsers: userList.filter(u => u.is_active).length,
        taskers: userList.filter(u => u.role === 'tasker').length,
        qaReviewers: userList.filter(u => u.role === 'qa').length,
        completionRate: taskList.length > 0
          ? Math.round((taskList.filter(t => t.status === 'approved').length / taskList.length) * 100)
          : 0,
      })

      // Top performers: taskers with most approved tasks
      const taskerMap = {}
      taskList.filter(t => t.status === 'approved').forEach(t => {
        if (t.assigned_to) taskerMap[t.assigned_to] = (taskerMap[t.assigned_to] || 0) + 1
      })
      const performers = Object.entries(taskerMap)
        .map(([id, count]) => ({ id, count, user: userList.find(u => u.id === id) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      setTopPerformers(performers)
      setRecentActivity(logs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const actionLabels = {
    save_annotation: 'حفظ مسودة',
    submit_annotation: 'إرسال توسيم',
    review_approved: 'موافقة على مهمة',
    review_rejected: 'رفض مهمة',
    review_needs_revision: 'طلب تعديل',
    create_task: 'إنشاء مهمة',
    create_user: 'إنشاء مستخدم',
  }

  return (
    <Layout title="لوحة الإدارة" requireRole={['super_admin', 'admin']}>

      {/* Header */}
      <div style={{ marginBottom: '28px', direction: 'rtl' }}>
        <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '24px', fontWeight: '700', color: '#e6edf3', marginBottom: '4px' }}>
          لوحة الإدارة
        </h1>
        <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e' }}>
          نظرة شاملة على أداء المنصة
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Quick actions */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {[
              { href: '/admin/tasks', icon: '＋', label: 'إضافة مهمة', color: '#f0a500' },
              { href: '/admin/users', icon: '◎', label: 'إدارة المستخدمين', color: '#58a6ff' },
              { href: '/review', icon: '◈', label: 'قائمة المراجعة', color: '#bc8cff', badge: stats?.submittedTasks },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: `${item.color}10`,
                  border: `1px solid ${item.color}30`,
                  borderRadius: '8px',
                  color: item.color,
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  direction: 'rtl',
                  position: 'relative',
                }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      left: '-6px',
                      background: '#f85149',
                      color: '#fff',
                      fontSize: '10px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      minWidth: '18px',
                      textAlign: 'center',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <StatCard icon="▤" label="إجمالي المهام" value={stats?.totalTasks || 0} color="#58a6ff" />
            <StatCard icon="✦" label="موافق عليها" value={stats?.approvedTasks || 0} color="#3fb950" />
            <StatCard icon="⧖" label="بانتظار المراجعة" value={stats?.submittedTasks || 0} color="#bc8cff" />
            <StatCard icon="✗" label="مرفوضة" value={stats?.rejectedTasks || 0} color="#f85149" />
            <StatCard icon="◎" label="المستخدمون" value={stats?.totalUsers || 0} color="#f0a500" />
            <StatCard icon="%" label="معدل الإنجاز" value={`${stats?.completionRate || 0}%`} color="#3fb950" />
          </div>

          {/* Completion progress bar */}
          <div style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
            direction: 'rtl',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '600', color: '#e6edf3' }}>
                تقدم المشروع الكلي
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', color: '#f0a500', fontWeight: '700' }}>
                {stats?.completionRate}%
              </span>
            </div>
            <div className="progress-bar" style={{ height: '8px', marginBottom: '12px' }}>
              <div className="progress-fill" style={{ width: `${stats?.completionRate}%` }} />
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {[
                { label: 'موافق', count: stats?.approvedTasks, color: '#3fb950' },
                { label: 'مرفوض', count: stats?.rejectedTasks, color: '#f85149' },
                { label: 'قيد المراجعة', count: stats?.submittedTasks, color: '#bc8cff' },
                { label: 'معلق', count: stats?.pendingTasks, color: '#e3b341' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                  <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
                    {item.label}: <strong style={{ color: '#e6edf3' }}>{item.count}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Top performers */}
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', direction: 'rtl' }}>
                <h3 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3' }}>
                  أفضل المُشغِّلين
                </h3>
              </div>
              {topPerformers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', direction: 'rtl' }}>
                  <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e' }}>لا توجد بيانات بعد</p>
                </div>
              ) : (
                <div style={{ padding: '12px' }}>
                  {topPerformers.map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      marginBottom: '4px',
                      direction: 'rtl',
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: i === 0 ? 'rgba(240,165,0,0.2)' : '#21262d',
                        border: `2px solid ${i === 0 ? '#f0a500' : '#30363d'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: i === 0 ? '#f0a500' : '#8b949e',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.user?.full_name || p.user?.email || 'مستخدم'}
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#3fb950',
                        background: 'rgba(63,185,80,0.1)',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        flexShrink: 0,
                      }}>
                        {p.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', direction: 'rtl' }}>
                <h3 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3' }}>
                  آخر النشاطات
                </h3>
              </div>
              <div style={{ padding: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                {recentActivity.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', direction: 'rtl' }}>
                    <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e' }}>لا توجد نشاطات بعد</p>
                  </div>
                ) : (
                  recentActivity.map(log => (
                    <div key={log.id} style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '8px 4px',
                      borderBottom: '1px solid #21262d',
                      direction: 'rtl',
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: log.action.includes('approved') ? '#3fb950' :
                                    log.action.includes('rejected') ? '#f85149' :
                                    log.action.includes('submit') ? '#bc8cff' : '#f0a500',
                        flexShrink: 0,
                        marginTop: '6px',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
                          <strong style={{ color: '#e6edf3' }}>{log.user_profile?.full_name || '—'}</strong>
                          {' '}{actionLabels[log.action] || log.action}
                        </div>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#484f58', marginTop: '2px' }}>
                          {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: ar })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
