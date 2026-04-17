import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { signOut, ROLE_LABELS } from '../lib/auth'
import { useProfile } from './ProfileProvider'

const NAV = {
  super_admin: [
    { href: '/dashboard',            icon: '⊞', label: 'لوحة التحكم' },
    { href: '/admin',                icon: '⚙', label: 'الإدارة' },
    { href: '/admin/users',          icon: '◎', label: 'المستخدمون' },
    { href: '/admin/tasks',          icon: '▤', label: 'إدارة المهام' },
    { href: '/admin/bulk-upload',    icon: '⬆', label: 'رفع مهام' },
    { href: '/admin/distribution',   icon: '◉', label: 'التوزيع' },
    { href: '/tasks/queue',          icon: '☰', label: 'الطابور' },
    { href: '/tasks',                icon: '✦', label: 'مهامي' },
    { href: '/review',               icon: '◈', label: 'المراجعة', badge: 'pendingReview' },
  ],
  admin: [
    { href: '/dashboard',            icon: '⊞', label: 'لوحة التحكم' },
    { href: '/admin',                icon: '⚙', label: 'الإدارة' },
    { href: '/admin/users',          icon: '◎', label: 'المستخدمون' },
    { href: '/admin/tasks',          icon: '▤', label: 'إدارة المهام' },
    { href: '/admin/bulk-upload',    icon: '⬆', label: 'رفع مهام' },
    { href: '/admin/distribution',   icon: '◉', label: 'التوزيع' },
    { href: '/review',               icon: '◈', label: 'المراجعة', badge: 'pendingReview' },
  ],
  qa: [
    { href: '/dashboard',            icon: '⊞', label: 'لوحة التحكم' },
    { href: '/review',               icon: '◈', label: 'قائمة المراجعة', badge: 'pendingReview' },
  ],
  tasker: [
    { href: '/dashboard',            icon: '⊞', label: 'لوحة التحكم' },
    { href: '/tasks/queue',          icon: '☰', label: 'طابور مهامي', badge: 'pendingTasks' },
    { href: '/tasks',                icon: '✦', label: 'كل مهامي' },
  ],
}

const ROLE_COLOR = { super_admin: '#f0a500', admin: '#58a6ff', qa: '#bc8cff', tasker: '#3fb950' }

export default function Sidebar({ pendingReview = 0 }) {
  const router = useRouter()
  const { profile } = useProfile()
  const [collapsed, setCollapsed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [pendingTasks, setPendingTasks] = useState(0)

  // Fetch pending task count for tasker badge
  useEffect(() => {
    if (profile?.role !== 'tasker') return
    fetchPendingTasks()
  }, [profile])

  async function fetchPendingTasks() {
    try {
      const res = await fetch('/api/worker/my-tasks?status=pending&limit=1')
      const data = await res.json()
      if (data?.queue_stats) setPendingTasks(data.queue_stats.pending || 0)
    } catch {}
  }

  const handleSignOut = async () => {
    setSigning(true)
    await signOut()
    router.push('/login')
  }

  const navItems = profile ? (NAV[profile.role] || NAV.tasker) : []
  const badgeValues = { pendingReview, pendingTasks }

  return (
    <aside style={{
      width: collapsed ? '60px' : '216px',
      minHeight: '100vh',
      background: '#161b22',
      borderRight: '1px solid #30363d',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.22s ease',
      position: 'fixed', top: 0, left: 0, zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '14px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '56px' }}>
        <div style={{
          width: '30px', height: '30px',
          background: 'linear-gradient(135deg, #f0a500, #ffd700)',
          borderRadius: '8px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '16px', flexShrink: 0,
          boxShadow: '0 0 10px rgba(240,165,0,.28)',
        }}>◆</div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '800', color: '#e6edf3', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              Arab Annotators
            </div>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '10px', color: '#f0a500', whiteSpace: 'nowrap' }}>
              منصة التوسيم العربي
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {/* Group dividers for admin */}
        {navItems.map((item, idx) => {
          const isActive = router.pathname === item.href ||
            (item.href !== '/dashboard' && router.pathname.startsWith(item.href))
          const badgeVal = item.badge ? (badgeValues[item.badge] || 0) : 0

          // Add visual separator before distribution group
          const showDivider = !collapsed && (
            item.href === '/admin/bulk-upload' ||
            item.href === '/tasks/queue' ||
            item.href === '/review'
          )

          return (
            <div key={item.href}>
              {showDivider && (
                <div style={{ height: '1px', background: '#30363d', margin: '6px 4px', opacity: 0.5 }} />
              )}
              <Link href={item.href} passHref>
                <div
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    marginBottom: '2px',
                    position: 'relative',
                    borderRight: isActive ? '2px solid #f0a500' : '2px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && (
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>
                      {item.label}
                    </span>
                  )}
                  {badgeVal > 0 && (
                    <span style={{
                      position: collapsed ? 'absolute' : 'static',
                      top: collapsed ? '4px' : 'auto',
                      right: collapsed ? '4px' : 'auto',
                      minWidth: '18px', height: '18px',
                      background: item.badge === 'pendingTasks' ? '#3fb950' : '#f85149',
                      color: '#fff',
                      fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace',
                      fontWeight: '700', borderRadius: '9px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', flexShrink: 0,
                    }}>
                      {badgeVal > 99 ? '99+' : badgeVal}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid #30363d' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', color: '#484f58', cursor: 'pointer', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {collapsed ? '→' : '←'}
        </button>

        {profile && !collapsed && (
          <div style={{ padding: '8px 10px', borderRadius: '7px', marginBottom: '6px', background: 'rgba(240,165,0,.04)', border: '1px solid rgba(240,165,0,.08)' }}>
            {/* Avatar circle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: `${ROLE_COLOR[profile.role] || '#8b949e'}25`,
                border: `1.5px solid ${ROLE_COLOR[profile.role] || '#8b949e'}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: '700',
                color: ROLE_COLOR[profile.role] || '#8b949e',
              }}>
                {(profile.full_name || profile.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: '600', color: '#e6edf3', direction: 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.full_name || profile.email}
                </div>
              </div>
            </div>
            <span style={{
              display: 'inline-flex', padding: '2px 8px', borderRadius: '20px',
              fontSize: '10px', fontFamily: 'Cairo, sans-serif', fontWeight: '700',
              color: ROLE_COLOR[profile.role] || '#8b949e',
              background: `${ROLE_COLOR[profile.role] || '#8b949e'}15`,
              border: `1px solid ${ROLE_COLOR[profile.role] || '#8b949e'}35`,
            }}>
              {ROLE_LABELS[profile.role]}
            </span>
          </div>
        )}

        <button
          onClick={handleSignOut}
          disabled={signing}
          style={{ width: '100%', padding: collapsed ? '8px' : '7px 12px', background: 'transparent', border: '1px solid rgba(248,81,73,.25)', borderRadius: '6px', color: '#f85149', cursor: 'pointer', fontSize: '12px', fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '7px', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ flexShrink: 0 }}>⬡</span>
          {!collapsed && <span>{signing ? 'جاري...' : 'تسجيل الخروج'}</span>}
        </button>
      </div>
    </aside>
  )
}
