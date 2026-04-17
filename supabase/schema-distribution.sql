-- ============================================================
-- Arab Annotators v5 — Smart Distribution Schema
-- Run AFTER the base schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TASK ASSIGNMENTS TABLE
--    Core of the distribution system. One row per task+worker pair.
--    Replaces the simple `assigned_to` column for queue logic.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES public.tasks(id)     ON DELETE CASCADE,
  worker_id       UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,

  -- Lifecycle: pending → in_progress → completed → reviewed
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','reviewed','reassigned')),

  -- Position in worker's personal queue (1-based, lower = higher priority)
  queue_position  INTEGER NOT NULL DEFAULT 0,

  -- Soft lock: prevents two workers grabbing same task simultaneously
  locked_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked_at       TIMESTAMPTZ,

  -- Timing
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,

  -- If reassigned, track who had it before
  reassigned_from UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reassigned_at   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A task can only appear once per worker
  UNIQUE (task_id, worker_id)
);

-- ────────────────────────────────────────────────────────────
-- 2. WORKER QUEUES TABLE
--    Tracks each worker's queue metadata (head pointer, counts)
--    Avoids counting rows on every request.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.worker_queues (
  worker_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_assigned      INTEGER NOT NULL DEFAULT 0,
  total_completed     INTEGER NOT NULL DEFAULT 0,
  total_reviewed      INTEGER NOT NULL DEFAULT 0,
  current_position    INTEGER NOT NULL DEFAULT 0,   -- queue head pointer
  last_active_at      TIMESTAMPTZ,
  is_available        BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. DISTRIBUTION BATCHES TABLE
--    Tracks each bulk upload + distribution event for audit.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_batches (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_tasks     INTEGER NOT NULL DEFAULT 0,
  total_workers   INTEGER NOT NULL DEFAULT 0,
  tasks_per_worker INTEGER,                         -- base tasks per worker
  remainder_tasks  INTEGER DEFAULT 0,               -- extra tasks distributed to first N workers
  status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending','in_progress','completed','failed')),
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb
);

-- ────────────────────────────────────────────────────────────
-- 4. INDEXES — critical for performance at 10k+ tasks
-- ────────────────────────────────────────────────────────────

-- task_assignments
CREATE INDEX IF NOT EXISTS idx_ta_worker_id       ON public.task_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_ta_task_id         ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_ta_status          ON public.task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_ta_worker_status   ON public.task_assignments(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_ta_queue_pos       ON public.task_assignments(worker_id, queue_position);
CREATE INDEX IF NOT EXISTS idx_ta_locked_at       ON public.task_assignments(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ta_completed_at    ON public.task_assignments(completed_at) WHERE completed_at IS NOT NULL;

-- worker_queues
CREATE INDEX IF NOT EXISTS idx_wq_available       ON public.worker_queues(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_wq_last_active     ON public.worker_queues(last_active_at);

-- distribution_batches
CREATE INDEX IF NOT EXISTS idx_db_created_by      ON public.distribution_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_db_started_at      ON public.distribution_batches(started_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE TRIGGER update_task_assignments_updated_at
  BEFORE UPDATE ON public.task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_queues_updated_at
  BEFORE UPDATE ON public.worker_queues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 6. FUNCTION: Release stale locks (call from cron or on-demand)
--    Releases locks older than 30 minutes automatically.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_stale_locks()
RETURNS INTEGER AS $$
DECLARE
  released INTEGER;
BEGIN
  UPDATE public.task_assignments
  SET locked_by = NULL, locked_at = NULL
  WHERE locked_at IS NOT NULL
    AND locked_at < NOW() - INTERVAL '30 minutes';
  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 7. FUNCTION: Get next task for a worker (atomic, lock-safe)
--    Returns the next pending assignment, marks it in_progress.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_next_task_for_worker(p_worker_id UUID)
RETURNS TABLE(
  assignment_id UUID,
  task_id       UUID,
  proverb       TEXT,
  context_sentences TEXT[],
  queue_position INTEGER
) AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  -- First release any stale lock this worker might have
  UPDATE public.task_assignments
  SET locked_by = NULL, locked_at = NULL
  WHERE worker_id = p_worker_id
    AND locked_by = p_worker_id
    AND locked_at < NOW() - INTERVAL '30 minutes';

  -- Atomically grab the next pending task and lock it
  SELECT ta.id INTO v_assignment_id
  FROM public.task_assignments ta
  WHERE ta.worker_id = p_worker_id
    AND ta.status = 'pending'
    AND (ta.locked_by IS NULL OR ta.locked_at < NOW() - INTERVAL '30 minutes')
  ORDER BY ta.queue_position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_assignment_id IS NULL THEN
    RETURN;  -- No available tasks
  END IF;

  -- Mark it in_progress and lock it
  UPDATE public.task_assignments
  SET status    = 'in_progress',
      started_at = NOW(),
      locked_by  = p_worker_id,
      locked_at  = NOW()
  WHERE id = v_assignment_id;

  -- Update the tasks table too (for compatibility with existing UI)
  UPDATE public.tasks
  SET status = 'in_progress', updated_at = NOW()
  WHERE id = (SELECT task_id FROM public.task_assignments WHERE id = v_assignment_id);

  -- Update worker queue head pointer
  UPDATE public.worker_queues
  SET current_position = (SELECT queue_position FROM public.task_assignments WHERE id = v_assignment_id),
      last_active_at   = NOW()
  WHERE worker_id = p_worker_id;

  -- Return task details
  RETURN QUERY
  SELECT
    ta.id,
    ta.task_id,
    t.proverb,
    t.context_sentences,
    ta.queue_position
  FROM public.task_assignments ta
  JOIN public.tasks t ON t.id = ta.task_id
  WHERE ta.id = v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 8. FUNCTION: Mark task completed (atomic)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_task_assignment(
  p_assignment_id UUID,
  p_worker_id     UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_task_id UUID;
  v_success BOOLEAN := false;
BEGIN
  UPDATE public.task_assignments
  SET status       = 'completed',
      completed_at = NOW(),
      locked_by    = NULL,
      locked_at    = NULL
  WHERE id        = p_assignment_id
    AND worker_id = p_worker_id
    AND status    = 'in_progress'
  RETURNING task_id INTO v_task_id;

  IF v_task_id IS NOT NULL THEN
    -- Update the tasks table status
    UPDATE public.tasks SET status = 'submitted', updated_at = NOW() WHERE id = v_task_id;

    -- Update worker queue counters
    UPDATE public.worker_queues
    SET total_completed = total_completed + 1, last_active_at = NOW()
    WHERE worker_id = p_worker_id;

    v_success := true;
  END IF;

  RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 9. FUNCTION: Detect inactive workers (for reassignment)
--    Returns workers who haven't been active for N hours.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inactive_workers(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
  worker_id          UUID,
  full_name          TEXT,
  email              TEXT,
  last_active_at     TIMESTAMPTZ,
  pending_tasks      BIGINT,
  in_progress_tasks  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wq.worker_id,
    p.full_name,
    p.email,
    wq.last_active_at,
    COUNT(ta.id) FILTER (WHERE ta.status = 'pending')     AS pending_tasks,
    COUNT(ta.id) FILTER (WHERE ta.status = 'in_progress') AS in_progress_tasks
  FROM public.worker_queues wq
  JOIN public.profiles p ON p.id = wq.worker_id
  LEFT JOIN public.task_assignments ta ON ta.worker_id = wq.worker_id
                                       AND ta.status IN ('pending','in_progress')
  WHERE (wq.last_active_at IS NULL OR wq.last_active_at < NOW() - (p_hours || ' hours')::INTERVAL)
    AND p.is_active = true
  GROUP BY wq.worker_id, p.full_name, p.email, wq.last_active_at
  HAVING COUNT(ta.id) FILTER (WHERE ta.status IN ('pending','in_progress')) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY for new tables
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.task_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_queues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_batches ENABLE ROW LEVEL SECURITY;

-- task_assignments: workers see only their own; admins see all
CREATE POLICY "ta_select"
  ON public.task_assignments FOR SELECT
  USING (worker_id = auth.uid() OR get_user_role() IN ('super_admin','admin','qa'));

CREATE POLICY "ta_update"
  ON public.task_assignments FOR UPDATE
  USING (worker_id = auth.uid() OR get_user_role() IN ('super_admin','admin'));

-- worker_queues: worker sees own; admin sees all
CREATE POLICY "wq_select"
  ON public.worker_queues FOR SELECT
  USING (worker_id = auth.uid() OR get_user_role() IN ('super_admin','admin'));

CREATE POLICY "wq_update"
  ON public.worker_queues FOR UPDATE
  USING (worker_id = auth.uid() OR get_user_role() IN ('super_admin','admin'));

-- distribution_batches: admin only
CREATE POLICY "db_select"
  ON public.distribution_batches FOR SELECT
  USING (get_user_role() IN ('super_admin','admin'));

-- ────────────────────────────────────────────────────────────
-- 11. VIEWS for reporting
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.worker_performance AS
SELECT
  p.id                                                                          AS worker_id,
  p.full_name,
  p.email,
  wq.total_assigned,
  wq.total_completed,
  ROUND(100.0 * wq.total_completed / NULLIF(wq.total_assigned, 0), 1)          AS completion_rate,
  COUNT(ta.id) FILTER (WHERE ta.status = 'pending')                            AS pending,
  COUNT(ta.id) FILTER (WHERE ta.status = 'in_progress')                        AS in_progress,
  COUNT(ta.id) FILTER (WHERE ta.status = 'completed')                          AS completed,
  AVG(EXTRACT(EPOCH FROM (ta.completed_at - ta.started_at)) / 60.0)
      FILTER (WHERE ta.completed_at IS NOT NULL AND ta.started_at IS NOT NULL)  AS avg_minutes_per_task,
  wq.last_active_at,
  wq.is_available
FROM public.profiles p
JOIN public.worker_queues wq ON wq.worker_id = p.id
LEFT JOIN public.task_assignments ta ON ta.worker_id = p.id
WHERE p.role = 'tasker' AND p.is_active = true
GROUP BY p.id, p.full_name, p.email, wq.total_assigned, wq.total_completed, wq.last_active_at, wq.is_available;

-- ============================================================
-- DONE — run schema-distribution.sql after schema.sql
-- ============================================================
