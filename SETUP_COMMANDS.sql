-- ============================================================
-- Arab Annotators - Setup Commands for amramramr22000@gmail.com
-- User ID: de57288b-9732-43cf-8540-1eca75c86706
-- ============================================================
-- شغّل هذه الأوامر بالترتيب في SQL Editor في Supabase

-- ============================================================
-- أمر 1: إعادة تشغيل الـ Trigger والوظائف الأساسية
-- ============================================================
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

-- ============================================================
-- أمر 2: تفعيل سياسات الوصول (RLS Policies)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- أمر 3: تعيين المستخدم كـ Super Admin
-- ============================================================
-- البريد: amramramr22000@gmail.com
-- User ID: de57288b-9732-43cf-8540-1eca75c86706
-- الدور: super_admin

INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'de57288b-9732-43cf-8540-1eca75c86706',
  'amramramr22000@gmail.com',
  'Amr',
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ============================================================
-- التحقق: اختر جدول profiles وتأكد من وجود السجل
-- ============================================================
-- SELECT * FROM public.profiles WHERE email = 'amramramr22000@gmail.com';
