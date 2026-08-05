ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS segment_count integer NOT NULL DEFAULT 0;