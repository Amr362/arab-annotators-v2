import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Auto-save hook with debounce
 * @param {Function} saveFn - async save function
 * @param {any[]} deps - array of values to watch (flat, not object)
 * @param {number} delay - debounce ms (default 2200)
 */
export function useAutoSave(saveFn, deps = [], delay = 2200) {
  const [status, setStatus] = useState('idle')
  const timerRef = useRef(null)
  const mountedRef = useRef(false)
  const saveFnRef = useRef(saveFn)

  // Keep saveFn ref fresh without triggering effect
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])

  // Watch deps with a serialized comparison
  const serialized = JSON.stringify(deps)
  const prevSerializedRef = useRef(serialized)

  useEffect(() => {
    // Skip the very first render
    if (!mountedRef.current) {
      mountedRef.current = true
      prevSerializedRef.current = serialized
      return
    }

    // Skip if nothing actually changed
    if (serialized === prevSerializedRef.current) return
    prevSerializedRef.current = serialized

    setStatus('dirty')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await saveFnRef.current()
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } catch {
        setStatus('error')
      }
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, delay])

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const forceSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('saving')
    try {
      await saveFnRef.current()
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e) {
      setStatus('error')
      throw e
    }
  }, [])

  return { status, forceSave }
}

/**
 * Auto-save status indicator
 */
export function AutoSaveIndicator({ status }) {
  const configs = {
    idle:   { color: '#484f58', icon: null,  text: null },
    dirty:  { color: '#e3b341', icon: '●',   text: 'غير محفوظ' },
    saving: { color: '#58a6ff', icon: '↻',   text: 'يحفظ...', spin: true },
    saved:  { color: '#3fb950', icon: '✓',   text: 'محفوظ تلقائياً' },
    error:  { color: '#f85149', icon: '⚠',   text: 'فشل الحفظ' },
  }
  const cfg = configs[status] || configs.idle
  if (!cfg.text) return null

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: cfg.color,
      transition: 'opacity 0.3s', direction: 'rtl',
    }}>
      <span style={{
        display: 'inline-block',
        animation: cfg.spin ? 'aispin 0.8s linear infinite' : 'none',
        fontSize: '11px',
      }}>{cfg.icon}</span>
      <span>{cfg.text}</span>
      {cfg.spin && (
        <style>{`@keyframes aispin { to { transform: rotate(360deg); } }`}</style>
      )}
    </span>
  )
}
