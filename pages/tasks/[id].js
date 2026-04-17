import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import StatusBadge from '../../components/ui/StatusBadge'
import { useProfile, ProfileProvider } from '../../components/ProfileProvider'
import { supabase } from '../../lib/supabase'
import { isAdmin, isQA } from '../../lib/auth'
import { useAutoSave, AutoSaveIndicator } from '../../lib/useAutoSave'
import { useKeyboardShortcuts, ShortcutBadge } from '../../lib/useKeyboardShortcuts'
import toast, { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

/* ── Confidence Stars ─────────────────────────────────────────────────────── */
function ConfidenceRating({ value, onChange, disabled }) {
  const labels = ['ضعيف', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', direction: 'rtl' }}>
      <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', whiteSpace: 'nowrap' }}>الجودة:</span>
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => !disabled && onChange(star === value ? 0 : star)}
            disabled={disabled}
            title={labels[star - 1]}
            style={{
              width: '18px', height: '18px', background: 'none', border: 'none',
              cursor: disabled ? 'default' : 'pointer', fontSize: '14px', padding: 0,
              color: star <= value ? '#f0a500' : '#30363d',
              transition: 'color 0.1s, transform 0.1s',
              transform: star <= value ? 'scale(1.1)' : 'scale(1)',
            }}
          >★</button>
        ))}
      </div>
      {value > 0 && (
        <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f0a500' }}>
          {labels[value - 1]}
        </span>
      )}
    </div>
  )
}

/* ── Word Count ────────────────────────────────────────────────────────────── */
function WordCount({ text }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return (
    <div style={{ display: 'flex', gap: '8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#484f58' }}>
      <span>{words} كلمة</span>
      <span>·</span>
      <span>{text.length} حرف</span>
    </div>
  )
}

/* ── Shortcuts Panel ──────────────────────────────────────────────────────── */
function ShortcutsPanel({ onClose }) {
  const shortcuts = [
    { keys: ['Ctrl', 'S'], label: 'حفظ المسودة' },
    { keys: ['Ctrl', 'Enter'], label: 'إرسال للمراجعة' },
    { keys: ['Alt', '→'], label: 'المهمة التالية' },
    { keys: ['Alt', '←'], label: 'المهمة السابقة' },
    { keys: ['Ctrl', '/'], label: 'عرض/إخفاء الاختصارات' },
    { keys: ['Esc'], label: 'إغلاق النوافذ المنبثقة' },
  ]
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '12px', padding: '28px', width: '380px', direction: 'rtl' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: '700', color: '#e6edf3' }}>⌨ اختصارات لوحة المفاتيح</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        {shortcuts.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #161b22' }}>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e' }}>{s.label}</span>
            <ShortcutBadge keys={s.keys} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Queue Item ────────────────────────────────────────────────────────────── */
function QueueItem({ task, isActive, onClick }) {
  const dot = { pending: '#e3b341', in_progress: '#58a6ff', submitted: '#bc8cff', approved: '#3fb950', rejected: '#f85149', needs_revision: '#ffa657' }
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px', borderBottom: '1px solid #0d1117', cursor: 'pointer',
        background: isActive ? 'rgba(240,165,0,0.07)' : 'transparent',
        borderRight: `3px solid ${isActive ? '#f0a500' : 'transparent'}`,
        transition: 'background 0.1s', display: 'flex', gap: '10px', alignItems: 'flex-start',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1c2128' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
        background: dot[task.status] || '#484f58',
        boxShadow: isActive ? `0 0 5px ${dot[task.status]}80` : 'none',
      }} />
      <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: isActive ? '#e6edf3' : '#8b949e', fontWeight: isActive ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', flex: 1 }}>
        {task.proverb}
      </span>
    </div>
  )
}

/* ── Response Panel ────────────────────────────────────────────────────────── */
function ResponsePanel({ index, value, onChange, confidence, onConfidenceChange, disabled }) {
  const filled = value.trim().length > 0
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const isTooShort = filled && wordCount < 4

  return (
    <div style={{
      background: filled ? 'rgba(63,185,80,0.03)' : '#161b22',
      border: `1px solid ${isTooShort ? 'rgba(227,179,65,0.4)' : filled ? 'rgba(63,185,80,0.2)' : '#30363d'}`,
      borderRadius: '10px', overflow: 'hidden',
      transition: 'border-color 0.25s, background 0.25s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: `1px solid ${filled ? 'rgba(63,185,80,0.08)' : '#21262d'}`,
        direction: 'rtl',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: filled ? 'rgba(63,185,80,0.15)' : 'rgba(72,79,88,0.2)',
            border: `2px solid ${filled ? '#3fb950' : '#484f58'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '700',
            color: filled ? '#3fb950' : '#484f58',
            fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0,
            transition: 'all 0.2s',
          }}>
            {filled ? '✓' : index + 1}
          </div>
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: filled ? '#c9d1d9' : '#8b949e' }}>
            الجملة {index + 1}
            {isTooShort && <span style={{ color: '#e3b341', fontSize: '11px', marginRight: '8px' }}> قصيرة جداً</span>}
          </span>
        </div>
        <WordCount text={value} />
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="استخدم المثل في سياق جملة عربية طبيعية..."
        style={{
          width: '100%', minHeight: '96px', padding: '14px 16px',
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: 'Cairo, sans-serif', fontSize: '15px',
          color: disabled ? '#8b949e' : '#e6edf3',
          direction: 'rtl', textAlign: 'right',
          lineHeight: '1.9', resize: 'vertical', boxSizing: 'border-box',
          cursor: disabled ? 'default' : 'text',
        }}
      />

      {/* Footer: confidence rating */}
      {!disabled && (
        <div style={{ padding: '8px 14px 12px', borderTop: filled ? '1px solid rgba(63,185,80,0.08)' : '1px solid #21262d' }}>
          <ConfidenceRating value={confidence} onChange={onConfidenceChange} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

/* ── Main Workspace ──────────────────────────────────────────────────────── */
export default function TaskWorkspace() {
  const router = useRouter()
  const { id } = router.query
  const { profile } = useProfile()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [responses, setResponses] = useState(['', '', ''])
  const [confidence, setConfidence] = useState([0, 0, 0])
  const [notes, setNotes] = useState('')
  const [allTasks, setAllTasks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [queueSearch, setQueueSearch] = useState('')
  const [lastReview, setLastReview] = useState(null)
  const [assignmentId, setAssignmentId] = useState(null)   // task_assignments.id
  const annotationRef = useRef(null)

  const isReadOnly = task?.status === 'submitted' || task?.status === 'approved'
  const canSubmit = responses.every(r => r.trim().length >= 3) && !isReadOnly
  const completedCount = responses.filter(r => r.trim().length > 0).length
  const filteredQueue = allTasks.filter(t => !queueSearch || t.proverb?.includes(queueSearch))

  useEffect(() => {
    if (id && profile) { fetchTask(); fetchAllTasks() }
  }, [id, profile])

  async function fetchAllTasks() {
    let q = supabase.from('tasks').select('id, proverb, status').order('created_at', { ascending: false })
    if (!isAdmin(profile)) q = q.eq('assigned_to', profile.id)
    const { data } = await q
    if (data) {
      setAllTasks(data)
      const idx = data.findIndex(t => t.id === id)
      setCurrentIndex(idx >= 0 ? idx : 0)
    }
  }

  async function fetchTask() {
    setLoading(true)
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select('*, assigned_profile:assigned_to(full_name, email), created_profile:created_by(full_name, email)')
      .eq('id', id).single()

    if (error || !taskData) { toast.error('المهمة غير موجودة'); router.push('/tasks'); return }
    if (!isAdmin(profile) && taskData.assigned_to !== profile.id) {
      toast.error('غير مصرح لك'); router.push('/tasks'); return
    }

    setTask(taskData)

    const { data: annData } = await supabase
      .from('annotations').select('*')
      .eq('task_id', id).eq('annotator_id', profile.id).maybeSingle()

    if (annData) {
      annotationRef.current = annData
      setResponses([annData.response_1 || '', annData.response_2 || '', annData.response_3 || ''])
      setConfidence([annData.confidence_1 || 0, annData.confidence_2 || 0, annData.confidence_3 || 0])
      setNotes(annData.notes || '')
    }

    if (annData?.id) {
      const { data: rev } = await supabase
        .from('reviews').select('*, reviewer_profile:reviewer_id(full_name)')
        .eq('annotation_id', annData.id)
        .order('reviewed_at', { ascending: false }).limit(1).maybeSingle()
      setLastReview(rev)
    }

    if (taskData.status === 'pending') {
      await supabase.from('tasks').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', id)
      setTask(prev => ({ ...prev, status: 'in_progress' }))
    }

    // Look up assignment row (new distribution system)
    const { data: assignData } = await supabase
      .from('task_assignments')
      .select('id, status')
      .eq('task_id', id)
      .eq('worker_id', profile.id)
      .maybeSingle()
    if (assignData?.id) setAssignmentId(assignData.id)

    setLoading(false)
  }

  const saveAnnotation = useCallback(async () => {
    if (!profile || !id) return
    const payload = {
      task_id: id, annotator_id: profile.id,
      response_1: responses[0], response_2: responses[1], response_3: responses[2],
      confidence_1: confidence[0], confidence_2: confidence[1], confidence_3: confidence[2],
      notes, updated_at: new Date().toISOString(),
    }
    if (annotationRef.current) {
      const { error } = await supabase.from('annotations').update(payload).eq('id', annotationRef.current.id)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('annotations')
        .insert({ ...payload, created_at: new Date().toISOString() }).select().single()
      if (error) throw error
      annotationRef.current = data
    }
  }, [responses, confidence, notes, id, profile])

  const { status: saveStatus, forceSave } = useAutoSave(saveAnnotation, [responses, confidence, notes], 2200)

  const handleManualSave = useCallback(async () => {
    try { await forceSave(); toast.success('تم الحفظ ✓', { duration: 1500 }) }
    catch { toast.error('فشل الحفظ') }
  }, [forceSave])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) { toast.error('أكمل الجمل الثلاث أولاً'); return }
    setSubmitting(true)
    try {
      await forceSave()

      if (assignmentId && annotationRef.current) {
        // ── New distribution system: use atomic complete endpoint ──────────
        const res = await fetch('/api/task/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignmentId,
            task_id: id,
            response_1: responses[0],
            response_2: responses[1],
            response_3: responses[2],
            notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error || 'فشل الإرسال'); return }
      } else {
        // ── Legacy path: tasks assigned directly without distribution ──────
        if (annotationRef.current) {
          await supabase.from('annotations').update({ submitted_at: new Date().toISOString() }).eq('id', annotationRef.current.id)
        }
        await supabase.from('tasks').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', id)
        await supabase.from('audit_log').insert({ user_id: profile.id, action: 'submit_annotation', table_name: 'tasks', record_id: id })
      }

      setTask(prev => ({ ...prev, status: 'submitted' }))
      toast.success('أُرسلت للمراجعة! ✨', { duration: 3000 })
      const nextTask = allTasks.slice(currentIndex + 1).find(t => ['pending', 'in_progress', 'rejected', 'needs_revision'].includes(t.status))
      setTimeout(() => router.push(nextTask ? `/tasks/${nextTask.id}` : '/tasks/queue'), 1800)
    } catch (e) {
      toast.error('فشل الإرسال')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, forceSave, id, profile, allTasks, currentIndex, assignmentId, responses, notes])

  const goToNext = useCallback(() => {
    const next = allTasks[currentIndex + 1]
    if (next) router.push(`/tasks/${next.id}`)
    else toast('أنت في آخر مهمة 🏁', { duration: 2000 })
  }, [allTasks, currentIndex])

  const goToPrev = useCallback(() => {
    const prev = allTasks[currentIndex - 1]
    if (prev) router.push(`/tasks/${prev.id}`)
  }, [allTasks, currentIndex])

  useKeyboardShortcuts({
    'ctrl+s': handleManualSave,
    'ctrl+enter': handleSubmit,
    'alt+arrowright': goToNext,
    'alt+arrowleft': goToPrev,
    'ctrl+/': () => setShowShortcuts(s => !s),
    'escape': () => setShowShortcuts(false),
  }, !loading)

  /* ── Loading ── */
  if (loading) return (
    <Shell title="جارٍ التحميل...">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
        <div style={{ width: '44px', height: '44px', border: '3px solid rgba(240,165,0,0.15)', borderTopColor: '#f0a500', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#8b949e' }}>جاري تحميل المهمة...</span>
      </div>
    </Shell>
  )

  if (!task) return null

  /* ── Render ── */
  return (
    <Shell title={task.proverb?.slice(0, 40)}>
      {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* LEFT: Queue */}
        <div style={{ width: '248px', flexShrink: 0, background: '#0d1117', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #21262d', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link href="/tasks">
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ← المهام
                </span>
              </Link>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58', background: '#161b22', padding: '2px 8px', borderRadius: '20px' }}>
                {currentIndex + 1}/{allTasks.length}
              </span>
            </div>
            <input
              value={queueSearch}
              onChange={e => setQueueSearch(e.target.value)}
              placeholder="بحث في المهام..."
              style={{ width: '100%', padding: '6px 10px', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontFamily: 'Cairo, sans-serif', fontSize: '12px', direction: 'rtl', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredQueue.map(t => (
              <QueueItem key={t.id} task={t} isActive={t.id === id} onClick={() => router.push(`/tasks/${t.id}`)} />
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setShowShortcuts(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #21262d', borderRadius: '6px', padding: '5px 10px', color: '#484f58', cursor: 'pointer', fontSize: '11px', fontFamily: 'Cairo, sans-serif', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f0a500'; e.currentTarget.style.borderColor = 'rgba(240,165,0,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#484f58'; e.currentTarget.style.borderColor = '#21262d' }}
            >
              <span>⌨</span><span>اختصارات لوحة المفاتيح</span>
            </button>
          </div>
        </div>

        {/* CENTER: Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ height: '50px', flexShrink: 0, background: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <StatusBadge status={task.status} />
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>#{id?.slice(0, 8)}</span>
              <AutoSaveIndicator status={saveStatus} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={goToPrev} disabled={currentIndex === 0} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', opacity: currentIndex === 0 ? 0.35 : 1 }} title="Alt+←">← السابق</button>
              <button onClick={goToNext} disabled={currentIndex === allTasks.length - 1} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', opacity: currentIndex === allTasks.length - 1 ? 0.35 : 1 }} title="Alt+→">التالي →</button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>

            {/* Proverb hero card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(240,165,0,0.07) 0%, rgba(240,165,0,0.02) 100%)',
              border: '1px solid rgba(240,165,0,0.2)', borderRadius: '12px',
              padding: '22px 26px', marginBottom: '18px', direction: 'rtl',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: '-30px', left: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,165,0,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '10px', fontWeight: '800', color: '#f0a500', letterSpacing: '2px', marginBottom: '10px', textTransform: 'uppercase' }}>
                ◆ المثل / الحكمة
              </div>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '24px', fontWeight: '800', color: '#e6edf3', lineHeight: '1.65' }}>
                {task.proverb}
              </div>
            </div>

            {/* Context sentences */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', marginBottom: '18px', overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'rtl' }}>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: '700', color: '#8b949e', letterSpacing: '0.5px' }}>الجمل السياقية المرجعية</span>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', background: '#0d1117', padding: '2px 8px', borderRadius: '20px' }}>{task.context_sentences?.length || 0} جمل</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(task.context_sentences || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', background: '#0d1117', border: '1px solid #21262d', borderRadius: '7px', direction: 'rtl' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: '700', color: '#f0a500', background: 'rgba(240,165,0,0.1)', padding: '2px 7px', borderRadius: '4px', flexShrink: 0, marginTop: '3px' }}>{i + 1}</span>
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#c9d1d9', lineHeight: '1.85' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback / status banners */}
            {lastReview && ['rejected', 'needs_revision'].includes(task.status) && (
              <div style={{ background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.22)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px', direction: 'rtl', display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{task.status === 'needs_revision' ? '📝' : '❌'}</span>
                <div>
                  <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '700', color: '#f85149', marginBottom: '5px' }}>ملاحظة المراجع — {lastReview.reviewer_profile?.full_name}</div>
                  <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#c9d1d9', lineHeight: '1.7' }}>{lastReview.feedback || 'يرجى مراجعة الإجابات.'}</div>
                </div>
              </div>
            )}
            {task.status === 'approved' && (
              <div style={{ background: 'rgba(63,185,80,0.06)', border: '1px solid rgba(63,185,80,0.22)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px', direction: 'rtl', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '22px' }}>✅</span>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#3fb950', fontWeight: '600' }}>تمت الموافقة على هذه المهمة</span>
              </div>
            )}
            {task.status === 'submitted' && (
              <div style={{ background: 'rgba(188,140,255,0.06)', border: '1px solid rgba(188,140,255,0.22)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px', direction: 'rtl', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '22px' }}>⧖</span>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#bc8cff', fontWeight: '600' }}>هذه المهمة بانتظار مراجعة QA</span>
              </div>
            )}

            {/* Responses */}
            <div style={{ marginBottom: '16px', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: '700', color: '#8b949e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  إجاباتك — استخدم المثل في جمل سياقية جديدة
                </span>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: completedCount === 3 ? '#3fb950' : '#8b949e' }}>
                  {completedCount}/3
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {responses.map((r, i) => (
                  <ResponsePanel
                    key={i} index={i} value={r}
                    onChange={val => { const nr = [...responses]; nr[i] = val; setResponses(nr) }}
                    confidence={confidence[i]}
                    onConfidenceChange={val => { const nc = [...confidence]; nc[i] = val; setConfidence(nc) }}
                    disabled={isReadOnly}
                  />
                ))}
              </div>
            </div>

            {/* Notes */}
            {!isReadOnly && (
              <div style={{ direction: 'rtl' }}>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: '600', color: '#484f58', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ملاحظات للمراجع (اختياري)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي توضيح أو ملاحظة تريد إيصالها..."
                  style={{ width: '100%', padding: '11px 14px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', color: '#8b949e', fontFamily: 'Cairo, sans-serif', fontSize: '13px', direction: 'rtl', resize: 'vertical', minHeight: '60px', outline: 'none', boxSizing: 'border-box', lineHeight: '1.7' }}
                  onFocus={e => e.target.style.borderColor = '#484f58'}
                  onBlur={e => e.target.style.borderColor = '#30363d'}
                />
              </div>
            )}

            <div style={{ height: '80px' }} />
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div style={{ width: '236px', flexShrink: 0, background: '#0d1117', borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>

          {/* Progress */}
          <div style={{ padding: '18px 16px', borderBottom: '1px solid #21262d', direction: 'rtl' }}>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: '700', color: '#484f58', letterSpacing: '0.5px', marginBottom: '14px', textTransform: 'uppercase' }}>التقدم</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              <svg width="54" height="54" viewBox="0 0 54 54" style={{ flexShrink: 0 }}>
                <circle cx="27" cy="27" r="21" fill="none" stroke="#21262d" strokeWidth="4" />
                <circle cx="27" cy="27" r="21" fill="none"
                  stroke={completedCount === 3 ? '#3fb950' : '#f0a500'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - completedCount / 3)}`}
                  transform="rotate(-90 27 27)"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <text x="27" y="27" textAnchor="middle" dominantBaseline="central"
                  fill={completedCount === 3 ? '#3fb950' : '#f0a500'}
                  fontSize="13" fontFamily="IBM Plex Mono, monospace" fontWeight="700"
                >{completedCount}/3</text>
              </svg>
              <div>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#e6edf3', fontWeight: '600', marginBottom: '3px' }}>
                  {completedCount === 3 ? 'مكتمل ✓' : completedCount === 0 ? 'لم يبدأ' : 'جاري...'}
                </div>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58' }}>
                  {completedCount < 3 ? `${3 - completedCount} جمل متبقية` : 'جاهز للإرسال'}
                </div>
              </div>
            </div>
            {/* Bar segments */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {responses.map((r, i) => (
                <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: r.trim() ? '#3fb950' : '#21262d', transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #21262d' }}>
            {!isReadOnly ? (
              <>
                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', background: 'transparent', border: '1px solid #30363d', borderRadius: '7px', color: '#8b949e', fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', direction: 'rtl' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#161b22'; e.currentTarget.style.color = '#e6edf3' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e' }}
                  title="Ctrl+S"
                >
                  {saveStatus === 'saving' ? <><div className="spinner" style={{ width: '13px', height: '13px' }} /><span>حفظ...</span></> : <><span>💾</span><span>حفظ مسودة</span><ShortcutBadge keys={['⌃S']} /></>}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '11px', borderRadius: '8px',
                    background: canSubmit ? 'linear-gradient(135deg, #f0a500 0%, #d4920a 100%)' : '#161b22',
                    border: canSubmit ? 'none' : '1px solid #30363d',
                    color: canSubmit ? '#0d1117' : '#484f58',
                    fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s', direction: 'rtl',
                    boxShadow: canSubmit ? '0 4px 16px rgba(240,165,0,0.25)' : 'none',
                  }}
                  title="Ctrl+Enter"
                >
                  {submitting ? <><div className="spinner" style={{ width: '15px', height: '15px', borderTopColor: '#0d1117' }} /><span>إرسال...</span></> : <><span>✈</span><span>إرسال للمراجعة</span></>}
                </button>

                {!canSubmit && (
                  <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', textAlign: 'center', direction: 'rtl', lineHeight: '1.6', margin: 0 }}>
                    أكمل الجمل الثلاث للإرسال
                  </p>
                )}
              </>
            ) : (
              <div style={{
                padding: '14px', borderRadius: '8px', textAlign: 'center', direction: 'rtl',
                background: task.status === 'approved' ? 'rgba(63,185,80,0.07)' : task.status === 'submitted' ? 'rgba(188,140,255,0.07)' : 'rgba(248,81,73,0.07)',
                border: `1px solid ${task.status === 'approved' ? 'rgba(63,185,80,0.25)' : task.status === 'submitted' ? 'rgba(188,140,255,0.25)' : 'rgba(248,81,73,0.25)'}`,
              }}>
                <div style={{ fontSize: '26px', marginBottom: '8px' }}>
                  {task.status === 'approved' ? '✅' : task.status === 'submitted' ? '⧖' : '❌'}
                </div>
                <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '600', color: task.status === 'approved' ? '#3fb950' : task.status === 'submitted' ? '#bc8cff' : '#f85149', margin: 0 }}>
                  {task.status === 'approved' ? 'موافق عليها' : task.status === 'submitted' ? 'قيد المراجعة' : 'مرفوضة'}
                </p>
              </div>
            )}

            {/* QA shortcut for admins */}
            {isQA(profile) && task.status === 'submitted' && (
              <Link href={`/review/${id}`}>
                <button style={{ width: '100%', padding: '8px', background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.25)', borderRadius: '7px', color: '#3fb950', fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '600', cursor: 'pointer', direction: 'rtl', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span>◈</span><span>مراجعة هذه المهمة</span>
                </button>
              </Link>
            )}
          </div>

          {/* Metadata */}
          <div style={{ padding: '16px', flex: 1, direction: 'rtl', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', fontWeight: '700', color: '#484f58', letterSpacing: '0.5px', marginBottom: '14px', textTransform: 'uppercase' }}>معلومات المهمة</div>
            {[
              { label: 'المُعيَّن إليه', value: task.assigned_profile?.full_name || '—' },
              { label: 'تاريخ الإنشاء', value: format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar }) },
              { label: 'آخر تحديث', value: format(new Date(task.updated_at), 'dd MMM · HH:mm', { locale: ar }) },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: '12px' }}>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '10px', color: '#484f58', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

/* ── Full-screen shell ─────────────────────────────────────────────────────── */
function Shell({ title, children }) {
  return (
    <>
      <Head>
        <title>{title} | Arab Annotators</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ background: '#0d1117', minHeight: '100vh' }}>
        {children}
      </div>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #21262d; border-radius: 2px; }
        .btn-secondary { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; background: transparent; color: #8b949e; font-weight: 500; font-size: 13px; border-radius: 6px; border: 1px solid #30363d; cursor: pointer; font-family: Cairo, sans-serif; transition: all 0.15s; }
        .btn-secondary:hover { background: #161b22; color: #e6edf3; border-color: #8b949e; }
        .btn-secondary:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(240,165,0,0.2); border-top-color: #f0a500; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  )
}
