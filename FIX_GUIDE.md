# دليل إصلاح مشكلة تعليق تسجيل الدخول (جاري الدخول...)

تم تشخيص المشكلة في مستودع `arab-annotators-v2`. المشكلة ليست في كود البرمجة (Frontend)، بل في إعدادات قاعدة البيانات (Supabase) التي تمنع التطبيق من إكمال عملية تسجيل الدخول بعد التحقق من البريد الإلكتروني.

## سبب المشكلة
عند تسجيل الدخول، يقوم التطبيق بالخطوات التالية:
1. التحقق من البريد وكلمة المرور عبر `supabase.auth`. (هذا الجزء يعمل لديك تماماً).
2. التوجيه إلى صفحة `/dashboard`.
3. في صفحة `/dashboard` (عبر `Layout.js` و `ProfileProvider.js`)، يحاول التطبيق جلب بيانات المستخدم من جدول `public.profiles`.
4. **هنا تكمن المشكلة:** إذا كان الجدول فارغاً أو لم يتم إنشاء سجل للمستخدم تلقائياً، يظل التطبيق في حالة "Loading" للأبد، مما يظهر لك عبارة "جاري الدخول" دون استجابة.

---

## ✅ الحل السريع والمخصص لك

### المستخدم: amramramr22000@gmail.com
**User ID:** `de57288b-9732-43cf-8540-1eca75c86706`

### الخطوة الوحيدة: شغّل أوامر SQL

1. اذهب إلى **Supabase Dashboard** → **SQL Editor**
2. انسخ الأوامر التالية ولصقها في محرر SQL
3. اضغط **Run** لتشغيلها

```sql
-- أمر 1: إعادة تشغيل الـ Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'tasker'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

```sql
-- أمر 2: تفعيل سياسات الوصول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

```sql
-- أمر 3: تعيين كـ Super Admin
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'de57288b-9732-43cf-8540-1eca75c86706',
  'amramramr22000@gmail.com',
  'Amr',
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
```

---

## ✅ التحقق من النجاح

بعد تشغيل الأوامر:

1. اذهب إلى **Table Editor** واختر جدول `profiles`
2. تأكد من وجود سجل لـ `amramramr22000@gmail.com` مع الدور `super_admin`
3. حاول تسجيل الدخول مرة أخرى

**النتيجة المتوقعة:** سيتم نقلك مباشرة إلى لوحة التحكم دون تعليق! 🎉

---

## 📝 ملاحظات إضافية

### إذا استمرت المشكلة:
- تحقق من أن متغيرات البيئة موجودة في Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- تحقق من سجلات الأخطاء في **Supabase → Logs**

### لإضافة مستخدمين آخرين:
استخدم نفس الطريقة مع تغيير البريد والـ ID والدور:

```sql
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'OTHER_USER_ID',
  'other-email@example.com',
  'User Name',
  'tasker',  -- أو 'admin' أو 'qa' أو 'super_admin'
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'tasker';
```

### الأدوار المتاحة:
- `super_admin`: صلاحيات كاملة على النظام
- `admin`: إدارة المهام والمستخدمين
- `qa`: مراجعة التعليقات والتصحيحات
- `tasker`: تنفيذ المهام والتعليقات (الدور الافتراضي)

---

## 📁 ملفات مساعدة

في المستودع ستجد:
- **SETUP_COMMANDS.sql**: جميع الأوامر في ملف واحد جاهز للنسخ
- **FIX_GUIDE.md** (هذا الملف): شرح مفصل للمشكلة والحل

---

**تم تحديث هذا الدليل:** 2026-04-17
**الحالة:** ✅ جاهز للتطبيق
