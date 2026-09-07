ALTER TABLE public._backfill_vn_junio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._backfill_vn_junio FROM anon, authenticated;
GRANT ALL ON public._backfill_vn_junio TO service_role;
CREATE POLICY "Admins manage backfill queue"
ON public._backfill_vn_junio FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));