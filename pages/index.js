import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    // getSession() is the correct client-side check — works on Vercel without issues
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/dashboard')
      else router.replace('/login')
    })
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0d1117', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: '48px', height: '48px',
        background: 'linear-gradient(135deg, #f0a500, #ffd700)',
        borderRadius: '12px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '28px',
        boxShadow: '0 0 24px rgba(240,165,0,.3)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>◆</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}`}</style>
    </div>
  )
}
