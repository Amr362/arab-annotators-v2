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

### 4. إضافة المستخدم يدوياً (حل سريع)
إذا كنت تريد الدخول فوراً ببريدك الحالي، قم بتشغيل هذا الأمر في SQL Editor (مع استبدال القيم ببياناتك):

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('ID_الخاص_ببريدك_من_قسم_AUTH', 'your-email@example.com', 'Your Name', 'super_admin')
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
```

---

## ملاحظة هامة
تأكد من إضافة المتغيرات التالية في إعدادات **Vercel** أو ملف `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (مهم جداً لعمليات الإدارة)

بعد تنفيذ هذه الخطوات، سيتمكن التطبيق من التعرف على ملفك الشخصي فور تسجيل الدخول وسينقلك إلى لوحة التحكم مباشرة.
