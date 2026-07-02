CREATE TABLE IF NOT EXISTS public._bkp_gerentes_merge_20260701 AS
SELECT * FROM public.gerentes WHERE activo = true;

ALTER TABLE public._bkp_gerentes_merge_20260701 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._bkp_gerentes_merge_20260701 TO service_role;
CREATE POLICY "backup admin only" ON public._bkp_gerentes_merge_20260701
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));