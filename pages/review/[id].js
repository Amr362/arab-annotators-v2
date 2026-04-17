import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/ui/StatusBadge'
import { useProfile } from '../../components/ProfileProvider'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function ReviewWorkspace() {
  const router = useRouter()
  const { id } = router.query
  const { profile } = useProfile()

  const [task, setTask] = useState(null)
  const [annotation, setAnnotation] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // QA editable state
  const [editedResponses, setEditedResponses] = useState(['', '', ''])
  const [feedback, setFeedback] = useState('')
  const [decision, setDecision] = useState(null) // 'approved' | 'rejected' | 'needs_revision'
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (id && profile) fetchData()
  }, [id, profile])

  async function fetchData() {
    setLoading(true)
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select(`*, assigned_profile:assigned_to(full_name, email)`)
      .eq('id', id)
      .single()

    if (error || !taskData) {
      toast.error('المهمة غير موجودة')
      router.push('/review')
      return
    }

    setTask(taskData)

    // Get annotation
    const { data: annData } = await supabase
      .from('annotations')
      .select(`*, annotator_profile:annotator_id(full_name, email)`)
      .eq('task_id', id)
      .maybeSingle()

    if (annData) {
      setAnnotation(annData)
      setEditedResponses([annData.response_1 || '', annData.response_2 || '', annData.response_3 || ''])
    }

    // Get review history
    const { data: revData } = await supabase
      .from('reviews')
      .select(`*, reviewer_profile:reviewer_id(full_name, email)`)
      .eq('annotation_id', annData?.id)
      .order('reviewed_at', { ascending: false })

    setReviews(revData || [])
    setLoading(false)
  }

  async function handleDecision() {
    if (!decision) {
      toast.error('يرجى اختيار قرار: موافقة أو رفض أو يحتاج تعديل')
      return
    }
    if ((decision === 'rejected' || decision === 'needs_revision') && !feedback.trim()) {
      toast.error('يرجى كتابة ملاحظة عند الرفض أو طلب التعديل')
      return
    }

    setSubmitting(true)
    try {
      // Create review record
      const reviewPayload = {
        annotation_id: annotation.id,
        reviewer_id: profile.id,
        status: decision,
        feedback: feedback.trim() || null,
        edited_response_1: editMode ? editedResponses[0] : null,
        edited_response_2: editMode ? editedResponses[1] : null,
        edited_response_3: editMode ? editedResponses[2] : null,
        reviewed_at: new Date().toISOString(),
      }

      const { error: reviewError } = await supabase.from('reviews').insert(reviewPayload)
      if (reviewError) throw reviewError

      // If approved and edited, update annotation
      if (decision === 'approved' && editMode) {
        await supabase.from('annotations').update({
          response_1: editedResponses[0],
          response_2: editedResponses[1],
          response_3: editedResponses[2],
          updated_at: new Date().toISOString(),
        }).eq('id', annotation.id)
      }

      // Update task status
      await supabase.from('tasks').update({
        status: decision,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: profile.id,
        action: `review_${decision}`,
        table_name: 'tasks',
        record_id: id,
        new_data: { decision, feedback },
      })

      const messages = {
        approved: '✅ تمت الموافقة على المهمة',
        rejected: '❌ تم رفض المهمة وإشعار المُشغِّل',
        needs_revision: '📝 تم إرسال طلب التعديل للمُشغِّل',
      }

      toast.success(messages[decision])

      // Go to next in queue
      setTimeout(() => router.push('/review'), 1500)
    } catch (e) {
      toast.error('حدث خطأ: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <Layout title="جارٍ التحميل..." requireRole={['super_admin', 'admin', 'qa']}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    </Layout>
  )

  const isAlreadyReviewed = task?.status !== 'submitted'

  return (
    <Layout title="مراجعة المهمة" requireRole={['super_admin', 'admin', 'qa']}>
      <div style={{ display: 'flex', gap: '24px' }}>

        {/* MAIN: Review content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Task header */}
          <div style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', direction: 'rtl' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <StatusBadge status={task?.status} />
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>#{id?.slice(0, 8)}</span>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
                  مُشغِّل: {task?.assigned_profile?.full_name || '—'}
                </span>
              </div>
              <Link href="/review">
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  ← العودة للقائمة
                </button>
              </Link>
            </div>

            {/* Proverb display */}
            <div style={{
              padding: '16px 20px',
              background: 'rgba(240,165,0,0.05)',
              border: '1px solid rgba(240,165,0,0.15)',
              borderRadius: '8px',
              direction: 'rtl',
            }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#f0a500', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                المثل / الحكمة
              </div>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '800', color: '#e6edf3', lineHeight: '1.7' }}>
                {task?.proverb}
              </div>
            </div>
          </div>

          {/* Context sentences */}
          <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', direction: 'rtl' }}>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '700', color: '#8b949e', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              الجمل السياقية
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(task?.context_sentences || []).map((s, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 14px',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                }}>
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#f0a500', fontWeight: '700',
                    background: 'rgba(240,165,0,0.1)', padding: '2px 8px', borderRadius: '4px', flexShrink: 0, marginTop: '2px'
                  }}>{i + 1}</span>
                  <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '15px', color: '#c9d1d9', lineHeight: '1.8' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Annotation responses (editable) */}
          <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '700', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                إجابات المُشغِّل
              </div>
              {!isAlreadyReviewed && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  style={{
                    padding: '5px 12px',
                    background: editMode ? 'rgba(240,165,0,0.1)' : 'transparent',
                    border: `1px solid ${editMode ? 'rgba(240,165,0,0.4)' : '#30363d'}`,
                    borderRadius: '6px',
                    color: editMode ? '#f0a500' : '#8b949e',
                    fontFamily: 'Cairo, sans-serif',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {editMode ? '✓ وضع التعديل نشط' : '✎ تعديل الإجابات'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {editedResponses.map((resp, i) => (
                <div key={i}>
                  <label style={{
                    display: 'block',
                    fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '600',
                    color: '#8b949e', marginBottom: '6px',
                  }}>
                    الإجابة {i + 1}
                  </label>
                  {editMode && !isAlreadyReviewed ? (
                    <textarea
                      value={resp}
                      onChange={e => {
                        const newR = [...editedResponses]
                        newR[i] = e.target.value
                        setEditedResponses(newR)
                      }}
                      className="input-field textarea-arabic"
                      rows={3}
                    />
                  ) : (
                    <div style={{
                      padding: '12px 16px',
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '6px',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: '15px',
                      color: '#c9d1d9',
                      lineHeight: '1.8',
                      minHeight: '48px',
                    }}>
                      {resp || <span style={{ color: '#484f58' }}>لا توجد إجابة</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Review history */}
          {reviews.length > 0 && (
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', direction: 'rtl' }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '700', color: '#8b949e', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                سجل المراجعات ({reviews.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviews.map((rev, i) => (
                  <div key={rev.id} style={{
                    padding: '12px 16px',
                    background: '#161b22',
                    border: `1px solid ${rev.status === 'approved' ? 'rgba(63,185,80,0.2)' : rev.status === 'rejected' ? 'rgba(248,81,73,0.2)' : 'rgba(255,166,87,0.2)'}`,
                    borderRadius: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <StatusBadge status={rev.status} />
                        <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>
                          {rev.reviewer_profile?.full_name || '—'}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#484f58' }}>
                        {format(new Date(rev.reviewed_at), 'dd MMM HH:mm', { locale: ar })}
                      </span>
                    </div>
                    {rev.feedback && (
                      <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', lineHeight: '1.6' }}>
                        {rev.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Decision panel */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {isAlreadyReviewed ? (
            <div style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '20px',
              direction: 'rtl',
            }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                  {task?.status === 'approved' ? '✅' : '📋'}
                </div>
                <StatusBadge status={task?.status} />
                <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '12px', lineHeight: '1.6' }}>
                  تمت مراجعة هذه المهمة بالفعل
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '20px',
              direction: 'rtl',
            }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: '700', color: '#e6edf3', marginBottom: '16px' }}>
                قرار المراجعة
              </div>

              {/* Decision buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {[
                  { value: 'approved', label: '✅ موافقة', color: '#3fb950' },
                  { value: 'needs_revision', label: '📝 يحتاج تعديل', color: '#ffa657' },
                  { value: 'rejected', label: '❌ رفض', color: '#f85149' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDecision(opt.value)}
                    style={{
                      padding: '12px 16px',
                      background: decision === opt.value ? `${opt.color}15` : 'transparent',
                      border: `2px solid ${decision === opt.value ? opt.color : '#30363d'}`,
                      borderRadius: '8px',
                      color: decision === opt.value ? opt.color : '#8b949e',
                      fontFamily: 'Cairo, sans-serif',
                      fontSize: '14px',
                      fontWeight: decision === opt.value ? '700' : '400',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'right',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Feedback */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '600',
                  color: '#8b949e', marginBottom: '6px',
                }}>
                  ملاحظة {(decision === 'rejected' || decision === 'needs_revision') ? '(مطلوبة)' : '(اختيارية)'}
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="اكتب ملاحظتك للمُشغِّل..."
                  className="input-field textarea-arabic"
                  rows={4}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleDecision}
                disabled={!decision || submitting}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px',
                  fontSize: '15px',
                  opacity: decision ? 1 : 0.5,
                  cursor: decision ? 'pointer' : 'not-allowed',
                  background: decision === 'approved' ? '#3fb950' :
                              decision === 'rejected' ? '#f85149' :
                              decision === 'needs_revision' ? '#ffa657' : '#f0a500',
                  color: '#0d1117',
                }}
              >
                {submitting
                  ? <><div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#0d1117' }} /><span>جاري الإرسال...</span></>
                  : <span>تأكيد القرار</span>
                }
              </button>
            </div>
          )}

          {/* Submission metadata */}
          {annotation && (
            <div style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '16px',
              direction: 'rtl',
            }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '700', color: '#8b949e', marginBottom: '12px' }}>
                معلومات الإرسال
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'المُشغِّل', value: annotation.annotator_profile?.full_name || '—' },
                  { label: 'تاريخ الإرسال', value: annotation.submitted_at ? format(new Date(annotation.submitted_at), 'dd MMM HH:mm', { locale: ar }) : '—' },
                  { label: 'إجمالي المراجعات', value: `${reviews.length} مرة` },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
