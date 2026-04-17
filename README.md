# Arab Annotators — منصة التوسيم العربي v3

منصة احترافية لتوسيم البيانات العربية وضمان الجودة.
**Next.js 14 + Supabase + Vercel**

---

## ⚡ Quick Deploy (3 خطوات)

### 1. أنشئ مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) → **New Project**
2. اختر منطقة قريبة (مثلاً `eu-west-1`)
3. من **Settings → API** انسخ:
   - `Project URL`
   - `anon public` key
   - `service_role` key

4. اذهب إلى **SQL Editor** وشغّل ملف `supabase/schema.sql` كاملاً

### 2. انشر على Vercel

```bash
# خيار A: Vercel CLI
npm i -g vercel
vercel

# خيار B: GitHub
# 1. ارفع المشروع على GitHub
# 2. اذهب إلى vercel.com → New Project → Import
```

### 3. أضف Environment Variables في Vercel

**Vercel Dashboard → Your Project → Settings → Environment Variables**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (service_role key) |
| `SUPER_ADMIN_EMAIL` | بريدك الإلكتروني |
| `SUPER_ADMIN_PASSWORD` | كلمة مرور قوية |
| `SETUP_SECRET_KEY` | أي نص سري عشوائي |

> ⚠️ انتبه: أضف المتغيرات لـ **Production + Preview + Development**

### 4. أنشئ المستخدمين الأوليين

بعد النشر، نفّذ هذا الأمر مرة واحدة فقط:

```bash
curl -X POST https://YOUR-APP.vercel.app/api/users/seed \
  -H "Content-Type: application/json" \
  -d '{"setupKey": "نفس قيمة SETUP_SECRET_KEY"}'
```

---

## 🔑 بيانات الدخول الافتراضية

| الدور | البريد | كلمة المرور |
|-------|--------|------------|
| سوبر أدمن | من `SUPER_ADMIN_EMAIL` | من `SUPER_ADMIN_PASSWORD` |
| QA 1 | qa1@arab-annotators.com | QA_Reviewer#2024! |
| QA 2 | qa2@arab-annotators.com | QA_Reviewer#2024@ |
| مُشغِّل 1 | tasker1@arab-annotators.com | Tasker#2024_01! |
| مُشغِّل 2 | tasker2@arab-annotators.com | Tasker#2024_02! |
| مُشغِّل 3 | tasker3@arab-annotators.com | Tasker#2024_03! |
| مُشغِّل 4 | tasker4@arab-annotators.com | Tasker#2024_04! |
| مُشغِّل 5 | tasker5@arab-annotators.com | Tasker#2024_05! |

> ⚠️ **غيّر كلمات المرور فور أول تسجيل دخول**

---

## 🏗️ Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (Pages Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Style | Tailwind CSS + Custom CSS |
| Fonts | Cairo (عربي) + IBM Plex |
| Deploy | Vercel |

---

## 🔐 ملاحظات أمنية

- `SUPABASE_SERVICE_ROLE_KEY` — **لا تضعه في client code أبداً** (يبدأ بـ SUPABASE_ بدون NEXT_PUBLIC_)
- `SETUP_SECRET_KEY` — استخدمه مرة واحدة ثم يمكن حذفه
- قاعدة البيانات محمية بـ Row Level Security على كل الجداول
- الـ middleware يحمي جميع الصفحات من الوصول بدون جلسة

---

## 🚨 حل مشاكل Vercel الشائعة

**Build فشل بسبب ESLint:**
→ `.eslintrc.json` موجود + `eslint.ignoreDuringBuilds: true` في `next.config.js` ✓

**`supabase.auth.getUser` error:**
→ تأكد أن متغيرات البيئة الأربعة مضافة في Vercel ✓

**صفحة بيضاء بعد تسجيل الدخول:**
→ تحقق أن `schema.sql` شُغِّل بالكامل في Supabase SQL Editor ✓

**`createPagesServerClient is not a function`:**
→ تأكد من إصدار `@supabase/auth-helpers-nextjs@0.10.0` ✓

**خطأ 500 في `/api/users/seed`:**
→ تأكد أن `SUPABASE_SERVICE_ROLE_KEY` مضاف في Vercel Environment Variables ✓

---

## 📁 هيكل المشروع

```
arab-annotators/
├── middleware.js              ← يحمي جميع الصفحات
├── pages/
│   ├── login.js               ← تسجيل الدخول
│   ├── dashboard.js           ← لوحة التحكم
│   ├── tasks/
│   │   ├── index.js           ← قائمة المهام
│   │   └── [id].js            ← workspace التوسيم
│   ├── review/
│   │   ├── index.js           ← قائمة المراجعة
│   │   └── [id].js            ← workspace المراجعة
│   ├── admin/
│   │   ├── index.js           ← لوحة الإدارة
│   │   ├── users.js           ← إدارة المستخدمين
│   │   └── tasks.js           ← إدارة المهام
│   └── api/users/
│       ├── manage.js          ← API: إنشاء/تعديل المستخدمين
│       └── seed.js            ← API: البذر الأولي
├── components/
│   ├── Layout.js
│   ├── Sidebar.js
│   └── ProfileProvider.js
├── lib/
│   ├── supabase.js            ← Supabase singleton clients
│   ├── auth.js                ← Role helpers
│   ├── useAutoSave.js         ← Auto-save hook
│   └── useKeyboardShortcuts.js
└── supabase/
    ├── schema.sql             ← شغّله أولاً
    └── schema-upgrade-v2.sql  ← للترقية من v1
```
