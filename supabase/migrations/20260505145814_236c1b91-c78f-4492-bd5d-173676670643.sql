ALTER TABLE public.metas_acv_gerentes
  ADD COLUMN IF NOT EXISTS anio integer DEFAULT 2026;

UPDATE public.metas_acv_gerentes SET anio = 2026 WHERE anio IS NULL;

CREATE INDEX IF NOT EXISTS idx_metas_acv_gerentes_anio_pais
  ON public.metas_acv_gerentes(anio, pais, mes);