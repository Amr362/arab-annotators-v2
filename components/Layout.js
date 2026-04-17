import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import { useProfile } from './ProfileProvider'
import { supabase } from '../lib/supabase'
import { isQA } from '../lib/auth'

export default function Layout({ children, title = 'Arab Annotators', requireRole = null }) {
  const { profile, loading, profileMissing } = useProfile()
  const router = useRouter()
  const [pendingReview, setPendingReview] = useState(0)

  useEffect(() => {
    if (loading) return

    if (!profile) {
      if (profileMissing) {
        // مسجل دخول بدون profile — نعمل signOut أولاً لكسر الـ redirect loop
        supabase.auth.signOut().then(() => {
          router.push('/login')
        })
      } else {
        router.push('/login')
      }
      return
    }

    if (requireRole && !requireRole.includes(profile.role)) {
      router.push('/dashboard')
      return
    }

    if (isQA(profile)) fetchPendingCount()
  }, [profile, loading, profileMissing, requireRole])

  async function fetchPendingCount() {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
    setPendingReview(count || 0)
  }

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0d1117',
      flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: '44px', height: '44px',
        background: 'linear-gradient(135deg, #f0a500, #ffd700)',
        borderRadius: '12px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '26px', boxShadow: '0 0 24px rgba(240,165,0,.3)'
      }}>◆</div>
      <span style={{ color: '#8b949e', fontFamily: 'Cairo, sans-serif', fontSize: '13px' }}>
        جاري التحميل...
      </span>
    </div>
  )

  if (profileMissing) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0d1117',
      flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: '44px', height: '44px',
        background: 'linear-gradient(135deg, #f0a500, #ffd700)',
        borderRadius: '12px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '26px'
      }}>◆</div>
      <span style={{ color: '#f85149', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }}>
        خطأ في تحميل الملف الشخصي. جاري تسجيل الخروج...
      </span>
    </div>
  )

  if (!profile) return null

  return (
    <>
      <Head>
        <title>{title} | Arab Annotators</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>◆</text></svg>"
        />
      </Head>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117' }}>
        <Sidebar pendingReview={pendingReview} />
        <main style={{
          flex: 1, marginLeft: '216px',
          minHeight: '100vh', display: 'flex', flexDirection: 'column'
        }}>
          <header style={{
            height: '56px', background: '#161b22',
            borderBottom: '1px solid #30363d',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px', position: 'sticky', top: 0, zIndex: 50
          }}>
            <span style={{
              fontFamily: 'Cairo, sans-serif', fontSize: '15px',
              fontWeight: '600', color: '#e6edf3', direction: 'rtl'
            }}>
              {title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isQA(profile) && pendingReview > 0 && (
                <div
                  onClick={() => router.push('/review')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px',
                    background: 'rgba(188,140,255,.1)',
                    border: '1px solid rgba(188,140,255,.3)',
                    borderRadius: '20px', cursor: 'pointer'
                  }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#bc8cff' }} />
                  <span style={{
                    fontFamily: 'Cairo, sans-serif', fontSize: '12px',
                    color: '#bc8cff', fontWeight: '600'
                  }}>
                    {pendingReview} بانتظار المراجعة
                  </span>
                </div>
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '4px 12px',
                background: '#21262d', border: '1px solid #30363d',
                borderRadius: '20px'
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#3fb950', boxShadow: '0 0 5px #3fb950'
                }} />
                <span style={{
                  fontFamily: 'Cairo, sans-serif', fontSize: '12px',
                  color: '#8b949e', direction: 'rtl'
                }}>
                  {profile?.full_name || profile?.email}
                </span>
              </div>
            </div>
          </header>
          <div style={{ flex: 1, padding: '24px', animation: 'fadeIn .2s ease-out' }}>
            {children}
          </div>
        </main>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  )
}
