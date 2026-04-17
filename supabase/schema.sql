-- ============================================================
-- Arab Annotators — Clean Slate SQL v3
-- امسح كل حاجة قديمة وابدأ من أول
-- شغّله كله في Supabase SQL Editor مرة واحدة
-- ============================================================

-- ============================================================
-- 1. مسح كل السياسات القديمة
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. مسح الـ Triggers
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created          ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at    ON public.profiles;
DROP TRIGGER IF EXISTS update_tasks_updated_at       ON public.tasks;
DROP TRIGGER IF EXISTS update_annotations_updated_at ON public.annotations;

-- ============================================================
-- 3. مسح الـ Functions
-- ============================================================
DROP FUNCTION IF EXISTS public.handle_new_user()          CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role()            CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user()            CASCADE;

-- ============================================================
-- 4. مسح الجداول (بالترتيب — foreign keys أولاً)
-- ============================================================
DROP TABLE IF EXISTS public.audit_log   CASCADE;
DROP TABLE IF EXISTS public.reviews     CASCADE;
DROP TABLE IF EXISTS public.annotations CASCADE;
DROP TABLE IF EXISTS public.task_queue  CASCADE;
DROP TABLE IF EXISTS public.tasks       CASCADE;
DROP TABLE IF EXISTS public.profiles    CASCADE;

-- ============================================================
-- 5. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 6. الجداول
-- ============================================================

CREATE TABLE public.profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'tasker'
             CHECK (role IN ('super_admin', 'admin', 'qa', 'tasker')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tasks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proverb           TEXT NOT NULL,
  context_sentences TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','submitted','approved','rejected','needs_revision')),
  assigned_to       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.annotations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id      UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  annotator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  response_1   TEXT,
  response_2   TEXT,
  response_3   TEXT,
  confidence_1 SMALLINT DEFAULT 0 CHECK (confidence_1 BETWEEN 0 AND 5),
  confidence_2 SMALLINT DEFAULT 0 CHECK (confidence_2 BETWEEN 0 AND 5),
  confidence_3 SMALLINT DEFAULT 0 CHECK (confidence_3 BETWEEN 0 AND 5),
  notes        TEXT,
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, annotator_id)
);

CREATE TABLE public.reviews (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id     UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  reviewer_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status            TEXT NOT NULL
                    CHECK (status IN ('approved','rejected','needs_revision')),
  feedback          TEXT,
  edited_response_1 TEXT,
  edited_response_2 TEXT,
  edited_response_3 TEXT,
  reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name TEXT,
  record_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status       ON public.tasks(status);
CREATE INDEX idx_tasks_created_at   ON public.tasks(created_at DESC);
CREATE INDEX idx_annotations_task   ON public.annotations(task_id);
CREATE INDEX idx_annotations_user   ON public.annotations(annotator_id);
CREATE INDEX idx_reviews_annotation ON public.reviews(annotation_id);
CREATE INDEX idx_audit_user         ON public.audit_log(user_id);
CREATE INDEX idx_audit_created      ON public.audit_log(created_at DESC);

-- ============================================================
-- 8. Functions
-- ============================================================

-- auto updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ✅ get_user_role
-- SECURITY DEFINER + SET search_path = public
-- بيشتغل كـ postgres (superuser) → بيتجاوز RLS تماماً → مفيش circular recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ✅ handle_new_user
-- بيعمل profile أوتوماتيك عند أي تسجيل جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'tasker'),
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 9. Triggers
-- ============================================================
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 10. تفعيل RLS
-- ============================================================
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. سياسات PROFILES
-- ✅ SELECT بسيطة بدون function calls = مفيش recursion على الإطلاق
-- ============================================================

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ✅ UPDATE SELF: بدون subquery (كانت الـ subquery هي سبب المشكلة الأصلية)
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- الأدمن يعدّل أي profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- INSERT: الـ Trigger بيشتغل كـ postgres فبيتجاوز RLS تلقائياً
-- لكن API routes (service role) محتاجة policy
CREATE POLICY "profiles_insert_allowed"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR get_user_role() IN ('super_admin', 'admin')
  );

-- DELETE: الأدمن بس
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- ============================================================
-- 12. سياسات TASKS
-- ============================================================

CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "tasks_delete"
  ON public.tasks FOR DELETE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- ============================================================
-- 13. سياسات ANNOTATIONS
-- ============================================================

CREATE POLICY "annotations_select"
  ON public.annotations FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR annotator_id = auth.uid()
  );

CREATE POLICY "annotations_insert"
  ON public.annotations FOR INSERT
  WITH CHECK (annotator_id = auth.uid());

CREATE POLICY "annotations_update"
  ON public.annotations FOR UPDATE
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR annotator_id = auth.uid()
  );

CREATE POLICY "annotations_delete"
  ON public.annotations FOR DELETE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- ============================================================
-- 14. سياسات REVIEWS
-- ============================================================

CREATE POLICY "reviews_select"
  ON public.reviews FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR EXISTS (
      SELECT 1 FROM public.annotations a
      WHERE a.id = annotation_id AND a.annotator_id = auth.uid()
    )
  );

CREATE POLICY "reviews_insert"
  ON public.reviews FOR INSERT
  WITH CHECK (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    AND reviewer_id = auth.uid()
  );

CREATE POLICY "reviews_update"
  ON public.reviews FOR UPDATE
  USING (get_user_role() IN ('super_admin', 'admin', 'qa'));

-- ============================================================
-- 15. سياسات AUDIT LOG
-- ============================================================

CREATE POLICY "audit_log_select"
  ON public.audit_log FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "audit_log_insert"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 16. ✅ تعيين Super Admin
-- شغّل بعد ما تأكد من الـ UUID من Supabase Dashboard > Auth > Users
-- ============================================================

-- INSERT INTO public.profiles (id, email, full_name, role, is_active)
-- VALUES (
--   'YOUR_AUTH_USER_UUID_HERE',
--   'your@email.com',
--   'Super Admin',
--   'super_admin',
--   true
-- )
-- ON CONFLICT (id) DO UPDATE
--   SET role = 'super_admin', is_active = true, updated_at = NOW();

-- ============================================================
-- 17. تحقق بعد التشغيل
-- ============================================================
-- SELECT id, email, role, is_active FROM public.profiles;
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
