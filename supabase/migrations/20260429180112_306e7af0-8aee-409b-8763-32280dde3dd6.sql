ALTER TABLE public.catalogo_retos
  ADD COLUMN IF NOT EXISTS meses_campana text[];

ALTER TABLE public.config_rachas
  ADD COLUMN IF NOT EXISTS meses_campana text[];

COMMENT ON COLUMN public.catalogo_retos.meses_campana IS 'Lista de periodos YYYY-MM en los que aplica este reto (campañas). Vacío = aplica siempre.';
COMMENT ON COLUMN public.config_rachas.meses_campana IS 'Lista de periodos YYYY-MM en los que aplica esta racha (campañas). Vacío = aplica siempre.';