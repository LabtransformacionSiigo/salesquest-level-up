
-- ========================================
-- Table: metas_asesores
-- ========================================
CREATE TABLE public.metas_asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_asesor text NOT NULL,
  pais text DEFAULT 'COL',
  canal_direccion text NOT NULL,
  meta_fe integer DEFAULT 0,
  meta_nube integer DEFAULT 0,
  meta_total integer DEFAULT 0,
  anio_mes text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(documento_asesor, canal_direccion, anio_mes)
);

ALTER TABLE public.metas_asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view metas_asesores"
  ON public.metas_asesores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage metas_asesores"
  ON public.metas_asesores FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Table: ejecucion_asesores
-- ========================================
CREATE TABLE public.ejecucion_asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_asesor text NOT NULL,
  periodo text NOT NULL,
  canal_direccion text NOT NULL,
  pais text DEFAULT 'COL',
  ventas_fe integer DEFAULT 0,
  ventas_nube integer DEFAULT 0,
  ventas_total integer DEFAULT 0,
  acv_total numeric DEFAULT 0,
  cant_recomendados integer DEFAULT 0,
  productividad numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(documento_asesor, canal_direccion, periodo)
);

ALTER TABLE public.ejecucion_asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ejecucion_asesores"
  ON public.ejecucion_asesores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage ejecucion_asesores"
  ON public.ejecucion_asesores FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Columns on asesores
-- ========================================
ALTER TABLE public.asesores
  ADD COLUMN IF NOT EXISTS puntos_ranking integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS canal_direccion text;
