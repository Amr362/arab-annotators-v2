import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useProfile } from '../../components/ProfileProvider'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const FILTERS = [
  { value: 'submitted', label: 'بانتظار المراجعة', color: '#bc8cff' },
  { value: 'approved', label: 'موافق عليها', color: '#3fb950' },
  { value: 'rejected', label: 'مرفوضة', color: '#f85149' },
  { value: 'needs_revision', label: 'تحتاج تعديل', color: '#ffa657' },
  { value: 'all', label: 'الكل', color: '#8b949e' },
]

export default function ReviewQueue() {
  const { profile } = useProfile()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('submitted')

  useEffect(() => {
    if (profile) fetchTasks()
  }, [profile])

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_profile:assigned_to(full_name, email),
        annotations(id, annotator_id, submitted_at, response_1, response_2, response_3),
        reviews(id, reviewer_id, status, feedback, reviewed_at, reviewer_profile:reviewer_id(full_name))
      `)
      .in('status', ['submitted', 'approved', 'rejected', 'needs_revision'])
      .order('updated_at', { ascending: false })

    if (!error) setTasks(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all' ? tasks.length : tasks.filter(t => t.status === f.value).length
    return acc
  }, {})

  return (
    <Layout title="قائمة المراجعة" requireRole={['super_admin', 'admin', 'qa']}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', direction: 'rtl' }}>
        <div>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>
            قائمة المراجعة
          </h1>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
            {counts['submitted']} مهمة تنتظر مراجعتك
          </p>
        </div>
        <button onClick={fetchTasks} className="btn-secondary" style={{ direction: 'rtl' }}>
          <span>↺</span><span>تحديث</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '16px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: filter === f.value ? `1px solid ${f.color}40` : '1px solid #30363d',
              background: filter === f.value ? `${f.color}10` : 'transparent',
              color: filter === f.value ? f.color : '#8b949e',
              fontFamily: 'Cairo, sans-serif',
              fontSize: '13px',
              fontWeight: filter === f.value ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: filter === f.value ? `${f.color}20` : '#21262d',
              color: filter === f.value ? f.color : '#484f58',
            }}>
              {counts[f.value] || 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px',
          direction: 'rtl',
          background: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {filter === 'submitted' ? '🎉' : '📋'}
          </div>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#8b949e' }}>
            {filter === 'submitted' ? 'لا توجد مهام بانتظار المراجعة' : 'لا توجد مهام في هذه الفئة'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(task => (
            <ReviewTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </Layout>
  )
}

function ReviewTaskRow({ task }) {
  const annotation = task.annotations?.[0]
  const lastReview = task.reviews?.[task.reviews.length - 1]
  const filledCount = [annotation?.response_1, annotation?.response_2, annotation?.response_3].filter(Boolean).length

  return (
    <div style={{
      background: '#21262d',
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '20px',
      display: 'flex',
      gap: '20px',
      alignItems: 'flex-start',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,165,0,0.3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
    >
      {/* Status indicator */}
      <div style={{
        width: '4px',
        alignSelf: 'stretch',
        borderRadius: '2px',
        background: task.status === 'submitted' ? '#bc8cff' :
                    task.status === 'approved' ? '#3fb950' :
                    task.status === 'rejected' ? '#f85149' : '#ffa657',
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <StatusBadge status={task.status} />
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
              #{task.id.slice(0, 8)}
            </span>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
              بواسطة: {task.assigned_profile?.full_name || task.assigned_profile?.email || '—'}
            </span>
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
            {format(new Date(task.updated_at), 'dd MMM yyyy HH:mm', { locale: ar })}
          </span>
        </div>

        {/* Proverb */}
        <div style={{
          fontFamily: 'Cairo, sans-serif',
          fontSize: '16px',
          fontWeight: '700',
          color: '#e6edf3',
          marginBottom: '10px',
          lineHeight: '1.6',
        }}>
          {task.proverb}
        </div>

        {/* Annotation preview */}
        {annotation && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {[annotation.response_1, annotation.response_2, annotation.response_3].filter(Boolean).map((r, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                fontFamily: 'Cairo, sans-serif',
                fontSize: '12px',
                color: '#8b949e',
                maxWidth: '250px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#484f58', marginLeft: '6px' }}>{i + 1}.</span>
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Last review feedback */}
        {lastReview?.feedback && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(248,81,73,0.05)',
            border: '1px solid rgba(248,81,73,0.15)',
            borderRadius: '6px',
            marginBottom: '10px',
          }}>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#f85149' }}>
              ملاحظة سابقة: {lastReview.feedback}
            </span>
          </div>
        )}

        {/* Responses count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#484f58' }}>
            {filledCount}/3 إجابات مقدَّمة
          </span>
          <div className="progress-bar" style={{ width: '80px', display: 'inline-block' }}>
            <div className="progress-fill" style={{ width: `${(filledCount / 3) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Action */}
      <div style={{ flexShrink: 0 }}>
        <Link href={`/review/${task.id}`}>
          <button className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
            {task.status === 'submitted' ? '→ مراجعة' : '→ عرض'}
          </button>
        </Link>
      </div>
    </div>
  )
}
