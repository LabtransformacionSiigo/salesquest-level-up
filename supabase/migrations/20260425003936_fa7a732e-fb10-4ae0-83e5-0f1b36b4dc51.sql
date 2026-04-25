
-- Add anio_mes column to metas_gerentes for per-month aggregation
ALTER TABLE public.metas_gerentes ADD COLUMN IF NOT EXISTS anio_mes TEXT;

-- Backfill existing rows with current month so constraint change does not fail
UPDATE public.metas_gerentes
SET anio_mes = TO_CHAR(CURRENT_DATE, 'YYYYMM')
WHERE anio_mes IS NULL;

-- Drop the old unique constraint
ALTER TABLE public.metas_gerentes DROP CONSTRAINT IF EXISTS metas_gerentes_celula_canal_direccion_key;

-- Create new unique constraint including anio_mes
ALTER TABLE public.metas_gerentes
  ADD CONSTRAINT metas_gerentes_celula_canal_anio_mes_key UNIQUE (celula, canal_direccion, anio_mes);

-- Index for lookups by period
CREATE INDEX IF NOT EXISTS idx_metas_gerentes_anio_mes ON public.metas_gerentes(anio_mes);
