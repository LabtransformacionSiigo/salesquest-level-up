CREATE TABLE IF NOT EXISTS public.ventas_gerente_mensual (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pais text NOT NULL DEFAULT 'COL',
  anio integer NOT NULL,
  mes integer NOT NULL,
  periodo text NOT NULL,
  canal_direccion text NOT NULL,
  gerente text NOT NULL,
  gerente_normalizado text NOT NULL,
  celula text,
  familia text NOT NULL,
  unidades integer NOT NULL DEFAULT 0,
  acv numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ventas_gerente_mensual_unique UNIQUE (pais, periodo, canal_direccion, gerente_normalizado, familia)
);

CREATE INDEX IF NOT EXISTS idx_vgm_periodo ON public.ventas_gerente_mensual (periodo);
CREATE INDEX IF NOT EXISTS idx_vgm_gerente_norm ON public.ventas_gerente_mensual (gerente_normalizado);
CREATE INDEX IF NOT EXISTS idx_vgm_canal ON public.ventas_gerente_mensual (canal_direccion);
CREATE INDEX IF NOT EXISTS idx_vgm_celula ON public.ventas_gerente_mensual (celula);

ALTER TABLE public.ventas_gerente_mensual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ventas_gerente_mensual"
  ON public.ventas_gerente_mensual FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage ventas_gerente_mensual"
  ON public.ventas_gerente_mensual FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));