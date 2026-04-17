# دليل إصلاح مشكلة تعليق تسجيل الدخول (جاري الدخول...)

تم تشخيص المشكلة في مستودع `arab-annotators-v2`. المشكلة ليست في كود البرمجة (Frontend)، بل في إعدادات قاعدة البيانات (Supabase) التي تمنع التطبيق من إكمال عملية تسجيل الدخول بعد التحقق من البريد الإلكتروني.

## سبب المشكلة
عند تسجيل الدخول، يقوم التطبيق بالخطوات التالية:
1. التحقق من البريد وكلمة المرور عبر `supabase.auth`. (هذا الجزء يعمل لديك تماماً).
2. التوجيه إلى صفحة `/dashboard`.
3. في صفحة `/dashboard` (عبر `Layout.js` و `ProfileProvider.js`)، يحاول التطبيق جلب بيانات المستخدم من جدول `public.profiles`.
4. **هنا تكمن المشكلة:** إذا كان الجدول فارغاً أو لم يتم إنشاء سجل للمستخدم تلقائياً، يظل التطبيق في حالة "Loading" للأبد، مما يظهر لك عبارة "جاري الدخول" دون استجابة.

---

## خطوات الإصلاح (يجب تنفيذها في لوحة تحكم Supabase)

### 1. التأكد من وجود سجل للمستخدم في جدول `profiles`
اذهب إلى **Table Editor** في Supabase، واختر جدول `profiles`. تأكد من وجود سجل يحمل نفس الـ `id` الخاص ببريدك الإلكتروني (يمكنك إيجاد الـ `id` في قسم Authentication -> Users).

إذا لم يكن موجوداً، فهذا يعني أن الـ **Trigger** المسؤول عن الإنشاء التلقائي لم يعمل.

### 2. إعادة تشغيل الـ Trigger والوظائف الأساسية
قم بنسخ الكود التالي ولصقه في **SQL Editor** في Supabase وتشغيله (Run):

```sql
-- 1. التأكد من وجود وظيفة إنشاء الملف الشخصي تلقائياً
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

-- 2. ربط الوظيفة بعملية التسجيل
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. تفعيل سياسات الوصول (RLS Policies)
تأكد من أن المستخدم لديه صلاحية قراءة ملفه الشخصي. قم بتشغيل هذا الكود أيضاً:

```sql
-- تفعيل الحماية على الجدول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- السماح للمستخدمين المسجلين بقراءة الملفات الشخصية
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

### 4. تعيين المستخدم كـ Super Admin (الخطوة الإضافية)

**للمستخدم: amramramr22000@gmail.com**

قم بتنفيذ الخطوات التالية:

#### أ) أولاً: ابحث عن ID المستخدم
اذهب إلى **Authentication → Users** في Supabase، وابحث عن البريد `amramramr22000@gmail.com`، ثم انسخ الـ **User ID** (يبدو مثل: `550e8400-e29b-41d4-a716-446655440000`).

#### ب) ثانياً: قم بتشغيل هذا الأمر في SQL Editor
استبدل `YOUR_USER_ID_HERE` بالـ ID الذي نسخته:

```sql
-- تعيين المستخدم كـ super_admin
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'YOUR_USER_ID_HERE',
  'amramramr22000@gmail.com',
  'Amr',
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
```

### 5. إضافة المستخدمين الآخرين يدوياً (إذا لزم الأمر)
إذا كان لديك مستخدمون آخرون يريدون الدخول، استخدم نفس الطريقة أعلاه مع تغيير البريد والدور (role):

```sql
-- مثال: إضافة مستخدم عادي (tasker)
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'ANOTHER_USER_ID',
  'another-email@example.com',
  'User Name',
  'tasker',  -- أو 'admin' أو 'qa'
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'tasker';
```

---

## الأدوار المتاحة (Roles)
- `super_admin`: صلاحيات كاملة على النظام
- `admin`: إدارة المهام والمستخدمين
- `qa`: مراجعة التعليقات والتصحيحات
- `tasker`: تنفيذ المهام والتعليقات (الدور الافتراضي)

---

## ملاحظة هامة
تأكد من إضافة المتغيرات التالية في إعدادات **Vercel** أو ملف `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (مهم جداً لعمليات الإدارة)

بعد تنفيذ هذه الخطوات، سيتمكن التطبيق من التعرف على ملفك الشخصي فور تسجيل الدخول وسينقلك إلى لوحة التحكم مباشرة.

---

## خطوات التحقق
بعد تنفيذ الأوامر أعلاه:
1. اذهب إلى **Table Editor** واختر جدول `profiles`.
2. تأكد من وجود سجل لبريدك مع الدور الصحيح.
3. حاول تسجيل الدخول مرة أخرى.
4. إذا استمرت المشكلة، تحقق من **Logs** في Supabase للبحث عن أخطاء.
