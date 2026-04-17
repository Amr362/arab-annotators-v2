import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useProfile } from '../../components/ProfileProvider'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../lib/auth'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'معلق' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'submitted', label: 'مُرسَل' },
  { value: 'approved', label: 'موافق عليه' },
  { value: 'rejected', label: 'مرفوض' },
]

export default function TasksList() {
  const { profile } = useProfile()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (profile) fetchTasks()
  }, [profile])

  async function fetchTasks() {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_profile:assigned_to(full_name, email),
        annotations(id, submitted_at),
        reviews(id, status, feedback)
      `)
      .order('created_at', { ascending: false })

    if (!isAdmin(profile)) {
      query = query.eq('assigned_to', profile.id)
    }

    const { data, error } = await query
    if (!error) setTasks(data || [])
    setLoading(false)
  }

  const filtered = tasks.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search && !t.proverb?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <Layout title="المهام">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        direction: 'rtl',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>
            {isAdmin(profile) ? 'جميع المهام' : 'مهامي'}
          </h1>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
            {filtered.length} مهمة {filter !== 'all' ? `(${STATUS_FILTERS.find(f => f.value === filter)?.label})` : ''}
          </p>
        </div>
        {isAdmin(profile) && (
          <Link href="/admin/tasks">
            <button className="btn-primary">
              <span>＋</span>
              <span>إضافة مهمة</span>
            </button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="البحث في المهام..."
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '8px 12px',
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#e6edf3',
            fontFamily: 'Cairo, sans-serif',
            fontSize: '13px',
            direction: 'rtl',
          }}
        />

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filter === f.value ? '1px solid #f0a500' : '1px solid #30363d',
                background: filter === f.value ? 'rgba(240,165,0,0.1)' : 'transparent',
                color: filter === f.value ? '#f0a500' : '#8b949e',
                fontFamily: 'Cairo, sans-serif',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: filter === f.value ? '600' : '400',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks grid */}
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#8b949e' }}>
            لا توجد مهام في هذه الفئة
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} profile={profile} />
          ))}
        </div>
      )}
    </Layout>
  )
}

function TaskCard({ task, profile }) {
  const hasAnnotation = task.annotations?.length > 0
  const lastReview = task.reviews?.[task.reviews.length - 1]

  const canWork = task.status === 'pending' || task.status === 'in_progress' || task.status === 'rejected'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', direction: 'rtl' }}>
        <StatusBadge status={task.status} />
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: '#484f58',
        }}>
          {task.id.slice(0, 8)}
        </span>
      </div>

      {/* Proverb (main content) */}
      <div style={{
        fontFamily: 'Cairo, sans-serif',
        fontSize: '15px',
        fontWeight: '600',
        color: '#e6edf3',
        direction: 'rtl',
        lineHeight: '1.7',
        padding: '12px',
        background: 'rgba(240,165,0,0.05)',
        borderRadius: '6px',
        border: '1px solid rgba(240,165,0,0.1)',
      }}>
        {task.proverb}
      </div>

      {/* Context sentences preview */}
      {task.context_sentences && task.context_sentences.length > 0 && (
        <div style={{ direction: 'rtl' }}>
          <div style={{
            fontFamily: 'Cairo, sans-serif',
            fontSize: '11px',
            color: '#484f58',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
          }}>
            الجمل السياقية
          </div>
          <div style={{
            fontFamily: 'Cairo, sans-serif',
            fontSize: '13px',
            color: '#8b949e',
            lineHeight: '1.8',
          }}>
            {task.context_sentences[0]}
            {task.context_sentences.length > 1 && (
              <span style={{ color: '#484f58' }}> +{task.context_sentences.length - 1} أخرى</span>
            )}
          </div>
        </div>
      )}

      {/* Review feedback if rejected */}
      {lastReview?.feedback && task.status === 'rejected' && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(248,81,73,0.05)',
          border: '1px solid rgba(248,81,73,0.2)',
          borderRadius: '6px',
          direction: 'rtl',
        }}>
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f85149', fontWeight: '600', marginBottom: '4px' }}>
            ملاحظة المراجع:
          </div>
          <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
            {lastReview.feedback}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '8px',
        borderTop: '1px solid #30363d',
        direction: 'rtl',
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
          {format(new Date(task.created_at), 'dd MMM', { locale: ar })}
        </span>

        <Link href={`/tasks/${task.id}`}>
          <button
            className={canWork ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            {task.status === 'pending' ? 'ابدأ المهمة' :
             task.status === 'in_progress' ? 'متابعة' :
             task.status === 'rejected' ? 'تعديل وإعادة إرسال' :
             'عرض'}
          </button>
        </Link>
      </div>
    </div>
  )
}
