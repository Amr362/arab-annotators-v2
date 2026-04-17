-- ============================================================
-- Arab Annotators - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin', 'admin', 'qa', 'tasker')) NOT NULL DEFAULT 'tasker',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proverb TEXT NOT NULL,
  context_sentences TEXT[] NOT NULL DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected', 'needs_revision')) NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Annotations table
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  annotator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  response_1 TEXT,
  response_2 TEXT,
  response_3 TEXT,
  confidence_1 SMALLINT DEFAULT 0 CHECK (confidence_1 BETWEEN 0 AND 5),
  confidence_2 SMALLINT DEFAULT 0 CHECK (confidence_2 BETWEEN 0 AND 5),
  confidence_3 SMALLINT DEFAULT 0 CHECK (confidence_3 BETWEEN 0 AND 5),
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, annotator_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('approved', 'rejected', 'needs_revision')) NOT NULL,
  feedback TEXT,
  edited_response_1 TEXT,
  edited_response_2 TEXT,
  edited_response_3 TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log table (version history)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_annotations_task_id ON public.annotations(task_id);
CREATE INDEX IF NOT EXISTS idx_annotations_annotator_id ON public.annotations(annotator_id);
CREATE INDEX IF NOT EXISTS idx_reviews_annotation_id ON public.reviews(annotation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create profile on signup
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
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Everyone can read profiles (needed for name display)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- Only super_admin can insert profiles directly (normal creation via trigger)
CREATE POLICY "profiles_insert_service"
  ON public.profiles FOR INSERT
  WITH CHECK (get_user_role() IN ('super_admin', 'admin') OR auth.uid() = id);

-- ============================================================
-- TASKS POLICIES
-- ============================================================

-- Taskers see only their assigned tasks; admins/QA see all
CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR assigned_to = auth.uid()
  );

-- Only admins can create tasks
CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

-- Taskers can update their own tasks (status, etc.); admins can update any
CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR assigned_to = auth.uid()
  );

-- Only admins can delete tasks
CREATE POLICY "tasks_delete"
  ON public.tasks FOR DELETE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- ============================================================
-- ANNOTATIONS POLICIES
-- ============================================================

-- Annotators see their own; QA/admin see all
CREATE POLICY "annotations_select"
  ON public.annotations FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR annotator_id = auth.uid()
  );

-- Taskers can insert their own annotations
CREATE POLICY "annotations_insert"
  ON public.annotations FOR INSERT
  WITH CHECK (annotator_id = auth.uid());

-- Taskers update their own; QA/admin update any
CREATE POLICY "annotations_update"
  ON public.annotations FOR UPDATE
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR annotator_id = auth.uid()
  );

-- Only admins can delete annotations
CREATE POLICY "annotations_delete"
  ON public.annotations FOR DELETE
  USING (get_user_role() IN ('super_admin', 'admin'));

-- ============================================================
-- REVIEWS POLICIES
-- ============================================================

-- QA and admins can read all reviews; taskers see reviews of their tasks
CREATE POLICY "reviews_select"
  ON public.reviews FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    OR EXISTS (
      SELECT 1 FROM public.annotations a
      JOIN public.tasks t ON t.id = a.task_id
      WHERE a.id = annotation_id AND t.assigned_to = auth.uid()
    )
  );

-- QA and admins can insert reviews
CREATE POLICY "reviews_insert"
  ON public.reviews FOR INSERT
  WITH CHECK (
    get_user_role() IN ('super_admin', 'admin', 'qa')
    AND reviewer_id = auth.uid()
  );

-- QA and admins can update reviews
CREATE POLICY "reviews_update"
  ON public.reviews FOR UPDATE
  USING (get_user_role() IN ('super_admin', 'admin', 'qa'));

-- ============================================================
-- AUDIT LOG POLICIES
-- ============================================================

-- Admins can read all; users see their own
CREATE POLICY "audit_log_select"
  ON public.audit_log FOR SELECT
  USING (
    get_user_role() IN ('super_admin', 'admin')
    OR user_id = auth.uid()
  );

-- Anyone authenticated can insert audit logs
CREATE POLICY "audit_log_insert"
  ON public.audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid() OR get_user_role() IN ('super_admin', 'admin'));

-- No one can update or delete audit logs (immutable)
-- (no UPDATE or DELETE policy = blocked by default with RLS enabled)

-- ============================================================
-- SAMPLE DATA (optional - remove in production)
-- ============================================================

-- Uncomment to insert sample tasks after seeding users:
/*
INSERT INTO public.tasks (proverb, context_sentences, status) VALUES
('العقل زينة', ARRAY['العقل زينة الإنسان في كل مكان', 'من أوتي عقلاً فقد أوتي نعمة عظيمة', 'العقل زينة والجهل شين'], 'pending'),
('الصبر مفتاح الفرج', ARRAY['الصبر مفتاح الفرج لكل صابر', 'صبر على المصاعب حتى نال المراد', 'كن صبوراً فإن الصبر مفتاح الفرج'], 'pending'),
('من جد وجد', ARRAY['من جد وجد ومن زرع حصد', 'اجتهد في عملك لتصل إلى هدفك', 'لا نجاح بلا جد واجتهاد'], 'pending');
*/

-- ============================================================
-- DONE
-- ============================================================
-- After running this schema:
-- 1. Run the seed API: POST /api/users/seed with setupKey
-- 2. Assign tasks to taskers from admin panel
-- 3. Log in with provided credentials
