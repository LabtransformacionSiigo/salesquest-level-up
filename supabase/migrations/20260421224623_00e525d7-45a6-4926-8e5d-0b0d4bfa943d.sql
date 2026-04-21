-- catalogo_retos: nuevas columnas
ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS canal text DEFAULT 'VC';
ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS kpi text;
ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS familia_vc text;
ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS umbral_secundario numeric;
ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS dias_consecutivos integer;

CREATE INDEX IF NOT EXISTS idx_catalogo_retos_canal_ventana_activo
  ON public.catalogo_retos (canal, ventana_tiempo, activo);

-- config_rachas: nuevas columnas
ALTER TABLE public.config_rachas ADD COLUMN IF NOT EXISTS kpi text DEFAULT 'acv_plus';
ALTER TABLE public.config_rachas ADD COLUMN IF NOT EXISTS familia_vc text;
ALTER TABLE public.config_rachas ADD COLUMN IF NOT EXISTS umbral_legacy numeric;
ALTER TABLE public.config_rachas ADD COLUMN IF NOT EXISTS dias_lun_mie boolean DEFAULT false;