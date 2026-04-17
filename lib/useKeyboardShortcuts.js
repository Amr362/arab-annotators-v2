import { useEffect } from 'react'

/**
 * Keyboard shortcuts hook
 * @param {Object} shortcuts - map of key combos to handlers
 * Example: { 'ctrl+s': handleSave, 'ctrl+enter': handleSubmit, 'alt+arrowright': goNext }
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e) => {
      const parts = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')

      if (shortcuts[combo]) {
        // Don't fire if user is in a textarea unless it's Ctrl/Meta
        const tag = document.activeElement?.tagName
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        if (isInput && !e.ctrlKey && !e.metaKey && !e.altKey) return

        e.preventDefault()
        shortcuts[combo](e)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}

/**
 * Shortcut hint display component
 */
export function ShortcutBadge({ keys }) {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      {keys.map((k, i) => (
        <kbd key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1px 5px',
          background: 'rgba(139,148,158,0.15)',
          border: '1px solid rgba(139,148,158,0.3)',
          borderRadius: '3px',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          color: '#8b949e',
          lineHeight: '16px',
        }}>
          {k}
        </kbd>
      ))}
    </span>
  )
}
