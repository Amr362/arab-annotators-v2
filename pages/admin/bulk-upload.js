/**
 * /pages/admin/bulk-upload.js
 * Admin page for bulk task upload + auto-distribution
 */
import { useState, useRef } from 'react'
import Layout from '../../components/Layout'
import { useProfile } from '../../components/ProfileProvider'
import toast from 'react-hot-toast'

const EXAMPLE_JSON = JSON.stringify([
  { proverb: 'الصبر مفتاح الفرج', context_sentences: ['صبر على المصاعب حتى نال مراده في النهاية', 'قيل قديماً إن الصبر مفتاح الفرج لكل مؤمن', 'لا تيأس فالصبر مفتاح الفرج دائماً'] },
  { proverb: 'من جد وجد', context_sentences: ['اجتهد في دراستك لأن من جد وجد', 'حقق أهدافه لأنه آمن بأن من جد وجد', 'لا نجاح بلا جهد فمن جد وجد ومن زرع حصد'] },
], null, 2)

function ScoreBadge({ value, total, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '8px', minWidth: '100px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '28px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>{total}</div>
    </div>
  )
}

export default function BulkUpload() {
  const { profile } = useProfile()
  const fileRef = useRef(null)
  const [mode, setMode] = useState('json') // 'json' | 'file'
  const [jsonText, setJsonText] = useState('')
  const [shuffle, setShuffle] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [previewTasks, setPreviewTasks] = useState([])
  const [previewError, setPreviewError] = useState(null)

  function handleJsonChange(val) {
    setJsonText(val)
    setResult(null)
    setError(null)
    setPreviewTasks([])
    setPreviewError(null)

    if (!val.trim()) return
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) {
        setPreviewTasks(parsed.slice(0, 5))
      } else {
        setPreviewError('يجب أن تكون البيانات مصفوفة JSON')
      }
    } catch {
      setPreviewError('JSON غير صحيح — تأكد من الصياغة')
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      handleJsonChange(text)
    } catch {
      setPreviewError('تعذر قراءة الملف')
    }
  }

  async function handleSubmit() {
    setError(null)
    setResult(null)

    let tasks
    try {
      tasks = JSON.parse(jsonText)
      if (!Array.isArray(tasks)) { setError('البيانات يجب أن تكون مصفوفة'); return }
    } catch {
      setError('JSON غير صحيح'); return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, shuffle }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'حدث خطأ'); return }
      setResult(data)
      toast.success(`✅ تم إنشاء ${data.total_tasks} مهمة وتوزيعها على ${data.total_workers} مشغل`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReassign() {
    if (!window.confirm('هل تريد إعادة توزيع مهام المشغلين غير النشطين (أكثر من 24 ساعة)؟')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inactive_hours: 24 }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'خطأ'); return }
      toast.success(data.message || `تم إعادة توزيع ${data.reassigned_count} مهمة`)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = previewTasks.length > 0 && !previewError && !loading

  return (
    <Layout title="رفع مهام بالجملة" requireRole={['super_admin', 'admin']}>
      <div style={{ direction: 'rtl', maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: '700', color: '#e6edf3' }}>
              رفع وتوزيع المهام تلقائياً
            </h1>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>
              ارفع حتى 10,000 مهمة — يتم التوزيع فورياً على جميع المشغلين
            </p>
          </div>
          <button onClick={handleReassign} disabled={loading} className="btn-secondary">
            ⚡ إعادة توزيع المعطّلة
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', background: '#161b22', borderRadius: '8px', padding: '4px', border: '1px solid #30363d', width: 'fit-content' }}>
          {[{ id: 'json', label: '📝 نص JSON' }, { id: 'file', label: '📁 رفع ملف' }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '7px 18px', borderRadius: '6px', border: 'none',
              fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer',
              background: mode === m.id ? '#30363d' : 'transparent',
              color: mode === m.id ? '#e6edf3' : '#8b949e',
              fontWeight: mode === m.id ? '600' : '400',
              transition: 'all 0.15s',
            }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'flex-start' }}>
          {/* LEFT: Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Input area */}
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
              {mode === 'json' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', fontWeight: '600' }}>بيانات JSON</label>
                    <button onClick={() => handleJsonChange(EXAMPLE_JSON)} style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#58a6ff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      مثال
                    </button>
                  </div>
                  <textarea
                    value={jsonText}
                    onChange={e => handleJsonChange(e.target.value)}
                    placeholder={'[\n  {\n    "proverb": "المثل هنا",\n    "context_sentences": ["جملة 1", "جملة 2", "جملة 3"]\n  }\n]'}
                    style={{
                      width: '100%', height: '280px', background: '#0d1117', border: '1px solid #30363d',
                      borderRadius: '6px', padding: '12px', color: '#e6edf3',
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', lineHeight: '1.7',
                      resize: 'vertical', direction: 'ltr',
                    }}
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <input ref={fileRef} type="file" accept=".json,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
                  <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#8b949e', marginBottom: '16px' }}>
                    ارفع ملف JSON يحتوي على مصفوفة المهام
                  </p>
                  <button onClick={() => fileRef.current?.click()} className="btn-secondary">اختر ملف .json</button>
                  {jsonText && (
                    <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#3fb950', marginTop: '12px' }}>
                      ✓ تم تحميل الملف ({previewTasks.length}+ مهمة معاينة)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Validation feedback */}
            {previewError && (
              <div style={{ padding: '12px 16px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '6px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#f85149' }}>
                ⚠️ {previewError}
              </div>
            )}

            {/* Preview table */}
            {previewTasks.length > 0 && !previewError && (
              <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e', fontWeight: '600', marginBottom: '12px' }}>
                  معاينة أول {previewTasks.length} مهام:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previewTasks.map((t, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#161b22', borderRadius: '6px', border: '1px solid #30363d' }}>
                      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#f0a500', fontWeight: '600', marginBottom: '4px' }}>
                        {i + 1}. {t.proverb || '—'}
                      </div>
                      <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58' }}>
                        {(t.context_sentences || []).length} جمل سياقية
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '6px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#f85149' }}>
                ❌ {error}
              </div>
            )}
          </div>

          {/* RIGHT: Settings + Result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Settings */}
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#8b949e', fontWeight: '700', marginBottom: '14px' }}>إعدادات التوزيع</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '14px' }}>
                <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: shuffle ? '#3fb950' : '#30363d', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }} onClick={() => setShuffle(!shuffle)}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', transition: 'left 0.2s', left: shuffle ? '19px' : '3px' }} />
                </div>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#e6edf3' }}>ترتيب عشوائي</span>
              </label>

              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#484f58', lineHeight: '1.6', marginBottom: '16px' }}>
                {shuffle ? 'سيتم خلط ترتيب المهام قبل التوزيع' : 'سيتم التوزيع بالترتيب المُرسَل'}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              >
                {loading
                  ? <><div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#0d1117' }} /><span>جاري الرفع...</span></>
                  : <><span>⬆</span><span>رفع وتوزيع</span></>
                }
              </button>
            </div>

            {/* Result card */}
            {result && (
              <div style={{ background: 'rgba(63,185,80,0.06)', border: '1px solid rgba(63,185,80,0.25)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#3fb950', fontWeight: '700', marginBottom: '14px' }}>
                  ✅ تم التوزيع بنجاح
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <ScoreBadge value={result.total_tasks} total="مهمة" color="#f0a500" />
                  <ScoreBadge value={result.total_workers} total="مشغل" color="#58a6ff" />
                  <ScoreBadge value={result.tasks_per_worker} total="لكل مشغل (أساس)" color="#bc8cff" />
                  <ScoreBadge value={result.remainder || 0} total="مهام إضافية" color="#ffa657" />
                </div>

                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e', fontWeight: '600', marginBottom: '8px' }}>التوزيع التفصيلي:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {(result.distribution || []).map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#161b22', borderRadius: '4px' }}>
                      <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#e6edf3' }}>{d.worker_name || d.worker_id?.slice(0, 8)}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#f0a500', fontWeight: '700' }}>{d.count} مهمة</span>
                    </div>
                  ))}
                </div>

                {result.validation_errors?.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255,166,87,0.08)', borderRadius: '4px' }}>
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#ffa657' }}>
                      ⚠️ تم تخطي {result.skipped} مهمة بسبب أخطاء:
                    </div>
                    {result.validation_errors.slice(0, 3).map((e, i) => (
                      <div key={i} style={{ fontFamily: 'Cairo, sans-serif', fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>• {e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Format guide */}
            <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#8b949e', fontWeight: '600', marginBottom: '10px' }}>📋 صيغة البيانات المطلوبة</div>
              <pre style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#58a6ff', direction: 'ltr', lineHeight: '1.6', overflowX: 'auto', margin: 0 }}>
{`[
  {
    "proverb": "نص المثل",
    "context_sentences": [
      "الجملة الأولى",
      "الجملة الثانية",
      "الجملة الثالثة"
    ]
  }
]`}
              </pre>
              <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '10px', color: '#484f58', marginTop: '8px', lineHeight: '1.6' }}>
                الحد الأقصى: 10,000 مهمة في كل رفع<br />
                الصيغ المقبولة: .json أو نص مباشر
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
