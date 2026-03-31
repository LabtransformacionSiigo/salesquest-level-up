CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'sync',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync jobs"
ON public.sync_jobs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create sync jobs"
ON public.sync_jobs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sync jobs"
ON public.sync_jobs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON public.sync_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON public.sync_jobs (status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_table_name ON public.sync_jobs (table_name);