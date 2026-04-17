import { STATUS_LABELS } from '../../lib/auth'

export default function StatusBadge({ status, size = 'sm' }) {
  const padding = size === 'sm' ? '2px 8px' : '4px 12px'
  const fontSize = size === 'sm' ? '11px' : '13px'

  return (
    <span
      className={`status-${status}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        borderRadius: '20px',
        fontSize,
        fontFamily: 'Cairo, sans-serif',
        fontWeight: '600',
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}
