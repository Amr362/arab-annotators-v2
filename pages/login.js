import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { signIn } from '../lib/auth'
import { supabase } from '../lib/supabase'

/* ─── Password Strength ─────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' }
  let s = 0
  if (pw.length >= 8)  s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1) return { score: s, label: 'ضعيفة جداً', color: '#f85149' }
  if (s === 2) return { score: s, label: 'ضعيفة', color: '#ffa657' }
  if (s === 3) return { score: s, label: 'مقبولة', color: '#e3b341' }
  if (s === 4) return { score: s, label: 'قوية', color: '#3fb950' }
  return { score: s, label: 'قوية جداً ✓', color: '#58a6ff' }
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function Spinner() {
  return <div style={{ width:'18px', height:'18px', flexShrink:0, border:'2px solid rgba(13,17,23,0.3)', borderTopColor:'#0d1117', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
}

function Field({ label, type='text', value, onChange, placeholder, autoComplete, suffix, error }) {
  return (
    <div style={{ marginBottom:'16px', direction:'rtl' }}>
      <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'Cairo, sans-serif', fontSize:'13px', fontWeight:'600', color: error ? '#f85149' : '#8b949e', marginBottom:'7px' }}>
        <span>{label}</span>
      </label>
      <div style={{ position:'relative' }}>
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
          style={{ width:'100%', background:'#161b22', border:`1px solid ${error ? 'rgba(248,81,73,0.5)' : '#30363d'}`, borderRadius:'8px', padding: suffix ? '10px 42px 10px 12px' : '10px 12px', color:'#e6edf3', fontSize:'14px', fontFamily: type==='email'||type==='password' ? 'IBM Plex Mono, monospace' : 'Cairo, sans-serif', direction: type==='email'||type==='password' ? 'ltr' : 'rtl', outline:'none', transition:'border-color .15s, box-shadow .15s' }}
          onFocus={e => { e.target.style.borderColor = error ? '#f85149' : '#f0a500'; e.target.style.boxShadow = error ? '0 0 0 3px rgba(248,81,73,0.1)' : '0 0 0 3px rgba(240,165,0,0.1)' }}
          onBlur={e => { e.target.style.borderColor = error ? 'rgba(248,81,73,0.5)' : '#30363d'; e.target.style.boxShadow = 'none' }}
        />
        {suffix && <div style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)' }}>{suffix}</div>}
      </div>
      {error && <p style={{ fontFamily:'Cairo, sans-serif', fontSize:'11px', color:'#f85149', marginTop:'5px' }}>{error}</p>}
    </div>
  )
}

function Alert({ type, message }) {
  const s = { error:{ bg:'rgba(248,81,73,0.08)', border:'rgba(248,81,73,0.25)', color:'#f85149', icon:'✕' }, success:{ bg:'rgba(63,185,80,0.08)', border:'rgba(63,185,80,0.25)', color:'#3fb950', icon:'✓' }, info:{ bg:'rgba(88,166,255,0.08)', border:'rgba(88,166,255,0.25)', color:'#58a6ff', icon:'ℹ' } }[type] || { bg:'rgba(88,166,255,0.08)', border:'rgba(88,166,255,0.25)', color:'#58a6ff', icon:'ℹ' }
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'12px 14px', borderRadius:'8px', background:s.bg, border:`1px solid ${s.border}`, marginBottom:'20px', direction:'rtl', animation:'fadeSlideIn 0.25s ease' }}>
      <span style={{ color:s.color, fontSize:'13px', fontWeight:'700', flexShrink:0, marginTop:'1px' }}>{s.icon}</span>
      <p style={{ fontFamily:'Cairo, sans-serif', fontSize:'13px', color:s.color, lineHeight:'1.6' }}>{message}</p>
    </div>
  )
}

export default function Login() {
  const router = useRouter()
  const [panel, setPanel]       = useState('login')
  const [checking, setChecking] = useState(true)
  const [loading, setLoading]   = useState(false)
  const [alert, setAlert]       = useState(null)

  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPw, setShowLoginPw]     = useState(false)
  const [loginErrors, setLoginErrors]     = useState({})

  const [regName, setRegName]               = useState('')
  const [regEmail, setRegEmail]             = useState('')
  const [regPassword, setRegPassword]       = useState('')
  const [regConfirm, setRegConfirm]         = useState('')
  const [showRegPw, setShowRegPw]           = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [regErrors, setRegErrors]           = useState({})
  const strength = getStrength(regPassword)

  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotSent, setForgotSent]     = useState(false)
  const [forgotErrors, setForgotErrors] = useState({})
  const [countdown, setCountdown]       = useState(60)
  const timerRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/dashboard')
      else setChecking(false)
    })
    return () => clearInterval(timerRef.current)
  }, [])

  function switchPanel(p) { setAlert(null); setLoginErrors({}); setRegErrors({}); setForgotErrors({}); setPanel(p) }

  async function handleLogin(e) {
    e.preventDefault()
    const errs = {}
    if (!loginEmail.trim()) errs.email = 'البريد الإلكتروني مطلوب'
    else if (!/\S+@\S+\.\S+/.test(loginEmail)) errs.email = 'بريد غير صحيح'
    if (!loginPassword) errs.password = 'كلمة المرور مطلوبة'
    if (Object.keys(errs).length) { setLoginErrors(errs); return }
    setLoginErrors({}); setLoading(true); setAlert(null)
    const { error } = await signIn(loginEmail.trim(), loginPassword)
    if (error) { setAlert({ type:'error', message:'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }); setLoading(false) }
    else { setAlert({ type:'success', message:'مرحباً بك! جاري التوجيه...' }); setTimeout(() => router.push('/dashboard'), 800) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const errs = {}
    if (!regName.trim()) errs.name = 'الاسم الكامل مطلوب'
    else if (regName.trim().length < 3) errs.name = 'الاسم قصير جداً'
    if (!regEmail.trim()) errs.email = 'البريد الإلكتروني مطلوب'
    else if (!/\S+@\S+\.\S+/.test(regEmail)) errs.email = 'بريد غير صحيح'
    if (!regPassword) errs.password = 'كلمة المرور مطلوبة'
    else if (regPassword.length < 8) errs.password = 'يجب أن تكون 8 أحرف على الأقل'
    else if (strength.score < 2) errs.password = 'كلمة المرور ضعيفة جداً'
    if (!regConfirm) errs.confirm = 'تأكيد كلمة المرور مطلوب'
    else if (regConfirm !== regPassword) errs.confirm = 'كلمتا المرور غير متطابقتين'
    if (Object.keys(errs).length) { setRegErrors(errs); return }
    setRegErrors({}); setLoading(true); setAlert(null)
    const { data, error } = await supabase.auth.signUp({ email: regEmail.trim(), password: regPassword, options: { data: { full_name: regName.trim() } } })
    if (error) {
      let msg = 'حدث خطأ أثناء إنشاء الحساب.'
      if (error.message?.includes('already registered')) msg = 'هذا البريد مسجّل مسبقاً. حاول تسجيل الدخول.'
      setAlert({ type:'error', message: msg }); setLoading(false)
    } else if (data?.user && !data.session) {
      setAlert({ type:'info', message:'تم إنشاء حسابك! تحقق من بريدك الإلكتروني لتأكيد الحساب.' }); setLoading(false)
    } else {
      setAlert({ type:'success', message:'تم إنشاء حسابك بنجاح! جاري التوجيه...' }); setTimeout(() => router.push('/dashboard'), 1000)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    const errs = {}
    if (!forgotEmail.trim()) errs.email = 'البريد الإلكتروني مطلوب'
    else if (!/\S+@\S+\.\S+/.test(forgotEmail)) errs.email = 'بريد غير صحيح'
    if (Object.keys(errs).length) { setForgotErrors(errs); return }
    setForgotErrors({}); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setLoading(false)
    if (error) { setAlert({ type:'error', message:'تعذّر إرسال رسالة الاسترداد. تحقق من البريد وحاول مجدداً.' }) }
    else {
      setForgotSent(true); setCountdown(60)
      timerRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0 } return c - 1 }), 1000)
    }
  }

  if (checking) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0d1117' }}>
      <div style={{ width:'36px', height:'36px', border:'2px solid rgba(240,165,0,0.15)', borderTopColor:'#f0a500', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const geomSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><pattern id="g" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse"><polygon points="60,10 110,35 110,85 60,110 10,85 10,35" fill="none" stroke="rgba(240,165,0,0.06)" stroke-width="1"/><polygon points="60,25 95,42.5 95,77.5 60,95 25,77.5 25,42.5" fill="none" stroke="rgba(240,165,0,0.04)" stroke-width="1"/><circle cx="60" cy="60" r="5" fill="none" stroke="rgba(240,165,0,0.05)" stroke-width="1"/><line x1="60" y1="10" x2="60" y2="110" stroke="rgba(240,165,0,0.025)" stroke-width="0.5"/><line x1="10" y1="60" x2="110" y2="60" stroke="rgba(240,165,0,0.025)" stroke-width="0.5"/></pattern></defs><rect width="120" height="120" fill="url(#g)"/></svg>`

  return (
    <>
      <Head><title>تسجيل الدخول | Arab Annotators</title></Head>

      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fadeIn      { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseGlow   { 0%,100% { box-shadow:0 0 30px rgba(240,165,0,0.15); } 50% { box-shadow:0 0 55px rgba(240,165,0,0.32); } }
        @keyframes orbit       { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        .panel-enter { animation: fadeIn 0.3s ease; }
        .tab-btn { flex:1; padding:10px 4px; background:transparent; border:none; font-family:Cairo,sans-serif; font-size:13px; font-weight:600; color:#484f58; cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s; }
        .tab-btn:hover { color:#8b949e; }
        .tab-btn.active { color:#f0a500; border-bottom-color:#f0a500; }
        .submit-btn { width:100%; padding:13px; background:linear-gradient(135deg,#f0a500,#d4920a); color:#0d1117; font-family:Cairo,sans-serif; font-size:15px; font-weight:700; border:none; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 15px rgba(240,165,0,0.2); }
        .submit-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(240,165,0,0.35); }
        .submit-btn:active:not(:disabled) { transform:translateY(0); }
        .submit-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .ghost-btn { background:none; border:none; cursor:pointer; color:#484f58; display:flex; align-items:center; padding:4px; transition:color 0.15s; border-radius:4px; }
        .ghost-btn:hover { color:#8b949e; }
        .link-btn { background:none; border:none; cursor:pointer; color:#f0a500; font-family:Cairo,sans-serif; font-size:13px; font-weight:600; padding:0; text-decoration:underline; text-underline-offset:2px; transition:color 0.15s; }
        .link-btn:hover { color:#ffd700; }
        .strength-bar { height:3px; border-radius:2px; flex:1; background:#21262d; transition:background 0.3s; }
        @media (max-width:768px) { .login-branding { display:none !important; } .login-card-wrap { width:100% !important; padding:24px !important; } }
      `}</style>

      <div style={{ minHeight:'100vh', display:'flex', background:'#0d1117', backgroundImage:`url("data:image/svg+xml,${encodeURIComponent(geomSvg)}")` }}>

        {/* ── Branding ── */}
        <div className="login-branding" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 48px', borderLeft:'1px solid #21262d', background:'linear-gradient(180deg,rgba(13,17,23,0) 0%,rgba(240,165,0,0.02) 100%)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', width:'500px', height:'500px', border:'1px solid rgba(240,165,0,0.04)', borderRadius:'50%', top:'50%', left:'50%', animation:'orbit 60s linear infinite', transformOrigin:'0 0' }} />
          <div style={{ position:'absolute', width:'320px', height:'320px', border:'1px solid rgba(240,165,0,0.07)', borderRadius:'50%', top:'50%', left:'50%', animation:'orbit 35s linear infinite reverse', transformOrigin:'0 0' }} />

          <div style={{ maxWidth:'380px', textAlign:'center', position:'relative', zIndex:1 }}>
            <div style={{ width:'88px', height:'88px', margin:'0 auto 28px', background:'linear-gradient(135deg,#f0a500 0%,#ffd700 100%)', borderRadius:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'44px', color:'#0d1117', animation:'pulseGlow 4s ease-in-out infinite' }}>◆</div>

            <h1 style={{ fontFamily:'Cairo,sans-serif', fontSize:'30px', fontWeight:'800', color:'#e6edf3', marginBottom:'6px', letterSpacing:'-0.3px' }}>Arab Annotators</h1>
            <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'16px', color:'#f0a500', marginBottom:'48px' }}>منصة التوسيم العربي المتقدمة</p>

            {[
              { icon:'✦', title:'توسيم ذكي',    desc:'واجهة توسيم احترافية بدعم كامل للغة العربية' },
              { icon:'◈', title:'ضبط الجودة',   desc:'نظام مراجعة متكامل مع تتبع التعديلات' },
              { icon:'◉', title:'توزيع تلقائي', desc:'خوارزمية توزيع متوازنة للمهام على الفرق' },
              { icon:'⊞', title:'لوحة تحليلية', desc:'إحصائيات وتقارير أداء فورية' },
            ].map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'14px', padding:'14px 16px', borderRadius:'10px', background:'rgba(22,27,34,0.7)', border:'1px solid #21262d', marginBottom:'8px', direction:'rtl', animation:`fadeIn 0.4s ease ${0.1 * i}s both`, backdropFilter:'blur(4px)' }}>
                <div style={{ width:'32px', height:'32px', flexShrink:0, background:'rgba(240,165,0,0.1)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'#f0a500', fontSize:'14px' }}>{f.icon}</div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', fontWeight:'700', color:'#e6edf3', marginBottom:'2px' }}>{f.title}</div>
                  <div style={{ fontFamily:'Cairo,sans-serif', fontSize:'12px', color:'#484f58', lineHeight:'1.5' }}>{f.desc}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop:'28px' }}>
              <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'11px', color:'#484f58', padding:'4px 10px', borderRadius:'20px', border:'1px solid #21262d' }}>v5.0 · Next.js + Supabase</span>
            </div>
          </div>
        </div>

        {/* ── Auth Card ── */}
        <div className="login-card-wrap" style={{ width:'460px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 36px' }}>
          <div style={{ width:'100%', maxWidth:'385px', background:'rgba(22,27,34,0.97)', border:'1px solid #30363d', borderRadius:'16px', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }}>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid #21262d', padding:'0 24px', background:'rgba(13,17,23,0.5)' }}>
              <button className={`tab-btn ${panel==='login'    ? 'active' : ''}`} onClick={() => switchPanel('login')}>تسجيل الدخول</button>
              <button className={`tab-btn ${panel==='register' ? 'active' : ''}`} onClick={() => switchPanel('register')}>حساب جديد</button>
              <button className={`tab-btn ${panel==='forgot'   ? 'active' : ''}`} onClick={() => switchPanel('forgot')}>نسيت كلمة السر</button>
            </div>

            <div style={{ padding:'28px 24px' }}>

              {/* LOGIN */}
              {panel === 'login' && (
                <div className="panel-enter">
                  <div style={{ marginBottom:'22px', direction:'rtl' }}>
                    <h2 style={{ fontFamily:'Cairo,sans-serif', fontSize:'20px', fontWeight:'700', color:'#e6edf3', marginBottom:'4px' }}>مرحباً بعودتك 👋</h2>
                    <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58' }}>سجّل دخولك للوصول إلى لوحة التحكم</p>
                  </div>
                  {alert && <Alert type={alert.type} message={alert.message} />}
                  <form onSubmit={handleLogin} noValidate>
                    <Field label="البريد الإلكتروني" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" error={loginErrors.email} />
                    <Field label="كلمة المرور" type={showLoginPw ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" error={loginErrors.password}
                      suffix={<button type="button" className="ghost-btn" onClick={() => setShowLoginPw(v => !v)} tabIndex={-1}><EyeIcon visible={showLoginPw} /></button>} />
                    <div style={{ textAlign:'left', marginBottom:'20px', marginTop:'-8px' }}>
                      <button type="button" className="link-btn" style={{ fontSize:'12px' }} onClick={() => switchPanel('forgot')}>نسيت كلمة المرور؟</button>
                    </div>
                    <button type="submit" className="submit-btn" disabled={loading}>
                      {loading ? <><Spinner /><span>جاري الدخول...</span></> : <span>تسجيل الدخول</span>}
                    </button>
                  </form>
                  <div style={{ textAlign:'center', marginTop:'18px', direction:'rtl' }}>
                    <span style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58' }}>ليس لديك حساب؟ </span>
                    <button className="link-btn" onClick={() => switchPanel('register')}>أنشئ حساباً الآن</button>
                  </div>
                </div>
              )}

              {/* REGISTER */}
              {panel === 'register' && (
                <div className="panel-enter">
                  <div style={{ marginBottom:'22px', direction:'rtl' }}>
                    <h2 style={{ fontFamily:'Cairo,sans-serif', fontSize:'20px', fontWeight:'700', color:'#e6edf3', marginBottom:'4px' }}>إنشاء حساب جديد ✨</h2>
                    <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58' }}>انضم إلى فريق المُوسِّمين العرب</p>
                  </div>
                  {alert && <Alert type={alert.type} message={alert.message} />}
                  <form onSubmit={handleRegister} noValidate>
                    <Field label="الاسم الكامل" type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="محمد أحمد" autoComplete="name" error={regErrors.name} />
                    <Field label="البريد الإلكتروني" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" error={regErrors.email} />

                    {/* Password + strength meter */}
                    <div style={{ marginBottom:'16px', direction:'rtl' }}>
                      <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'Cairo,sans-serif', fontSize:'13px', fontWeight:'600', color: regErrors.password ? '#f85149' : '#8b949e', marginBottom:'7px' }}>
                        <span>كلمة المرور</span>
                        {regPassword && <span style={{ fontWeight:'600', fontSize:'11px', color:strength.color, transition:'color 0.3s' }}>{strength.label}</span>}
                      </label>
                      <div style={{ position:'relative' }}>
                        <input type={showRegPw ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password"
                          style={{ width:'100%', background:'#161b22', border:`1px solid ${regErrors.password ? 'rgba(248,81,73,0.5)' : '#30363d'}`, borderRadius:'8px', padding:'10px 42px 10px 12px', color:'#e6edf3', fontSize:'14px', fontFamily:'IBM Plex Mono,monospace', direction:'ltr', outline:'none', transition:'border-color .15s, box-shadow .15s' }}
                          onFocus={e => { e.target.style.borderColor = '#f0a500'; e.target.style.boxShadow = '0 0 0 3px rgba(240,165,0,0.1)' }}
                          onBlur={e => { e.target.style.borderColor = regErrors.password ? 'rgba(248,81,73,0.5)' : '#30363d'; e.target.style.boxShadow = 'none' }} />
                        <button type="button" className="ghost-btn" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)' }} onClick={() => setShowRegPw(v => !v)} tabIndex={-1}><EyeIcon visible={showRegPw} /></button>
                      </div>
                      {regPassword && (
                        <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="strength-bar" style={{ background: i <= strength.score ? strength.color : '#21262d' }} />
                          ))}
                        </div>
                      )}
                      {regErrors.password && <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'11px', color:'#f85149', marginTop:'5px' }}>{regErrors.password}</p>}
                    </div>

                    <Field label="تأكيد كلمة المرور" type={showRegConfirm ? 'text' : 'password'} value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" error={regErrors.confirm}
                      suffix={<button type="button" className="ghost-btn" onClick={() => setShowRegConfirm(v => !v)} tabIndex={-1}><EyeIcon visible={showRegConfirm} /></button>} />

                    <div style={{ padding:'10px 12px', borderRadius:'8px', background:'#161b22', border:'1px solid #21262d', marginBottom:'20px', direction:'rtl' }}>
                      <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'11px', color:'#484f58', lineHeight:'1.8' }}>
                        💡 كلمة مرور قوية: 8+ أحرف · أرقام · حروف كبيرة · رموز خاصة
                      </p>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                      {loading ? <><Spinner /><span>جاري الإنشاء...</span></> : <span>إنشاء الحساب</span>}
                    </button>
                  </form>
                  <div style={{ textAlign:'center', marginTop:'18px', direction:'rtl' }}>
                    <span style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58' }}>لديك حساب بالفعل؟ </span>
                    <button className="link-btn" onClick={() => switchPanel('login')}>سجّل الدخول</button>
                  </div>
                </div>
              )}

              {/* FORGOT */}
              {panel === 'forgot' && (
                <div className="panel-enter">
                  {!forgotSent ? (
                    <>
                      <div style={{ marginBottom:'22px', direction:'rtl' }}>
                        <h2 style={{ fontFamily:'Cairo,sans-serif', fontSize:'20px', fontWeight:'700', color:'#e6edf3', marginBottom:'4px' }}>استعادة كلمة المرور 🔑</h2>
                        <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58', lineHeight:'1.6' }}>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</p>
                      </div>
                      {alert && <Alert type={alert.type} message={alert.message} />}
                      <form onSubmit={handleForgot} noValidate>
                        <Field label="البريد الإلكتروني المسجّل" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" error={forgotErrors.email} />
                        <button type="submit" className="submit-btn" disabled={loading}>
                          {loading ? <><Spinner /><span>جاري الإرسال...</span></> : <span>إرسال رابط الاسترداد</span>}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="panel-enter" style={{ textAlign:'center', direction:'rtl', padding:'12px 0' }}>
                      <div style={{ width:'64px', height:'64px', margin:'0 auto 20px', background:'rgba(63,185,80,0.1)', border:'2px solid rgba(63,185,80,0.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px' }}>✉</div>
                      <h3 style={{ fontFamily:'Cairo,sans-serif', fontSize:'18px', fontWeight:'700', color:'#e6edf3', marginBottom:'8px' }}>تم إرسال الرابط!</h3>
                      <p style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#8b949e', lineHeight:'1.7', marginBottom:'20px' }}>
                        تحقق من صندوق الوارد في <strong style={{ color:'#f0a500' }}>{forgotEmail}</strong>.<br/>قد تجده في مجلد البريد المزعج.
                      </p>
                      {countdown > 0 ? (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'8px 16px', borderRadius:'20px', background:'#161b22', border:'1px solid #21262d', marginBottom:'20px' }}>
                          <div style={{ width:'16px', height:'16px', border:'2px solid #30363d', borderTopColor:'#f0a500', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
                          <span style={{ fontFamily:'Cairo,sans-serif', fontSize:'13px', color:'#484f58' }}>إعادة الإرسال بعد {countdown}ث</span>
                        </div>
                      ) : (
                        <button className="link-btn" style={{ display:'block', margin:'0 auto 20px' }} onClick={() => { setForgotSent(false); setAlert(null) }}>لم تصلك الرسالة؟ أعد الإرسال</button>
                      )}
                      <button className="link-btn" onClick={() => { setForgotSent(false); switchPanel('login') }}>← العودة لتسجيل الدخول</button>
                    </div>
                  )}
                  {!forgotSent && (
                    <div style={{ textAlign:'center', marginTop:'18px', direction:'rtl' }}>
                      <button className="link-btn" onClick={() => switchPanel('login')}>← العودة لتسجيل الدخول</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 24px', borderTop:'1px solid #21262d', background:'rgba(13,17,23,0.4)', textAlign:'center' }}>
              <p style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'10px', color:'#21262d', letterSpacing:'0.5px' }}>ARAB ANNOTATORS · SECURE LOGIN · v5</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
