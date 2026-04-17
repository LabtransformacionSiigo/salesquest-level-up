-- Add columns to metas_asesores
ALTER TABLE public.metas_asesores
  ADD COLUMN IF NOT EXISTS proyecto text,
  ADD COLUMN IF NOT EXISTS fecha_ingreso_asesor date,
  ADD COLUMN IF NOT EXISTS m_de_antiguedad numeric,
  ADD COLUMN IF NOT EXISTS dias_novedad integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reingreso text,
  ADD COLUMN IF NOT EXISTS dias_softlanding integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS caso_salud_ocupacional text,
  ADD COLUMN IF NOT EXISTS aplica_cuota_lider text,
  ADD COLUMN IF NOT EXISTS aplica_ejecucion_lider text,
  ADD COLUMN IF NOT EXISTS aplica_hc_minimo text,
  ADD COLUMN IF NOT EXISTS meta_sql_bono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_recomendados_bono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fe_bono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nube_bono integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bono integer DEFAULT 0;

-- Add formatted ACV column to metas_gerentes
ALTER TABLE public.metas_gerentes
  ADD COLUMN IF NOT EXISTS meta_total_acv_formato text;