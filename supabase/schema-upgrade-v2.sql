-- ============================================================
-- Arab Annotators - Schema Upgrade v2
-- Run AFTER schema.sql if upgrading from v1
-- ============================================================

-- Add confidence rating columns to annotations
ALTER TABLE public.annotations
  ADD COLUMN IF NOT EXISTS confidence_1 SMALLINT DEFAULT 0 CHECK (confidence_1 BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS confidence_2 SMALLINT DEFAULT 0 CHECK (confidence_2 BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS confidence_3 SMALLINT DEFAULT 0 CHECK (confidence_3 BETWEEN 0 AND 5);

-- Add maybeSingle-friendly unique index comment (no change needed, already exists)

-- ============================================================
-- NEW SCHEMA (include in schema.sql for fresh installs)
-- Replace the annotations table definition with this:
-- ============================================================

-- The annotations table now has:
-- response_1, response_2, response_3 TEXT
-- confidence_1, confidence_2, confidence_3 SMALLINT (0-5)
-- notes TEXT
-- submitted_at TIMESTAMPTZ
-- created_at, updated_at TIMESTAMPTZ

COMMENT ON COLUMN public.annotations.confidence_1 IS 'Self-reported quality rating 1-5 (0 = not rated)';
COMMENT ON COLUMN public.annotations.confidence_2 IS 'Self-reported quality rating 1-5 (0 = not rated)';
COMMENT ON COLUMN public.annotations.confidence_3 IS 'Self-reported quality rating 1-5 (0 = not rated)';
