ALTER TABLE public.catalogo_retos ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.gerentes(id) ON DELETE SET NULL;
ALTER TABLE public.config_rachas ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.gerentes(id) ON DELETE SET NULL;
ALTER TABLE public.catalogo_medallas ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.gerentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalogo_retos_gerente ON public.catalogo_retos(gerente_id) WHERE gerente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_config_rachas_gerente ON public.config_rachas(gerente_id) WHERE gerente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalogo_medallas_gerente ON public.catalogo_medallas(gerente_id) WHERE gerente_id IS NOT NULL;