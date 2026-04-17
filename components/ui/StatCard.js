export default function StatCard({ icon, label, value, color = '#f0a500', change }) {
  return (
    <div style={{
      background: '#21262d',
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = `${color}50`}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}>
          {icon}
        </div>
        {change !== undefined && (
          <div style={{
            fontSize: '12px',
            fontFamily: 'Cairo, sans-serif',
            color: change >= 0 ? '#3fb950' : '#f85149',
            background: change >= 0 ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            padding: '2px 8px',
            borderRadius: '20px',
          }}>
            {change >= 0 ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: '#8b949e', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
        {label}
      </div>
    </div>
  )
}
