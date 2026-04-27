ALTER TABLE public.metas_acv_gerentes ADD COLUMN IF NOT EXISTS meta_fe integer NOT NULL DEFAULT 0;
ALTER TABLE public.metas_acv_gerentes ADD COLUMN IF NOT EXISTS meta_nube integer NOT NULL DEFAULT 0;