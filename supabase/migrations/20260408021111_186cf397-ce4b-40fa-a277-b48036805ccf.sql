
-- ========================================
-- Table: metas_gerentes (from Databricks tbl_brz_gerentes)
-- ========================================
CREATE TABLE IF NOT EXISTS public.metas_gerentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pais_gestion text,
  canal_direccion text NOT NULL,
  director text,
  celula text NOT NULL,
  m text,
  cuota numeric DEFAULT 0,
  hc_operativo integer DEFAULT 0,
  fe integer DEFAULT 0,
  nube integer DEFAULT 0,
  coi integer DEFAULT 0,
  noi integer DEFAULT 0,
  siigo_fiscal integer DEFAULT 0,
  meta_total_und integer DEFAULT 0,
  meta_total_acv numeric DEFAULT 0,
  recomendados integer DEFAULT 0,
  efectividad_sql numeric DEFAULT 0,
  productividad numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(celula, canal_direccion)
);

ALTER TABLE public.metas_gerentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view metas_gerentes"
  ON public.metas_gerentes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage metas_gerentes"
  ON public.metas_gerentes FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Table: ventas_diarias (daily sales for Empresarios & Aliados)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ventas_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date,
  asesor text NOT NULL,
  celula text,
  director text,
  equipo text,
  tipo_producto text,
  producto text,
  unidades integer DEFAULT 0,
  acv numeric DEFAULT 0,
  recurrencia text,
  origen text,
  canal_direccion text NOT NULL,
  pais text DEFAULT 'COL',
  created_at timestamptz DEFAULT now(),
  UNIQUE(fecha, asesor, tipo_producto, canal_direccion, producto)
);

ALTER TABLE public.ventas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ventas_diarias"
  ON public.ventas_diarias FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage ventas_diarias"
  ON public.ventas_diarias FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Table: productividad_asesores (monthly productivity from Databricks)
-- ========================================
CREATE TABLE IF NOT EXISTS public.productividad_asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio_mes text NOT NULL,
  asesor text NOT NULL,
  pais text DEFAULT 'COL',
  celula text,
  area text,
  rango_antiguedad text,
  cant_recomendados integer DEFAULT 0,
  ventas_mm_recomendados numeric DEFAULT 0,
  sc_creados integer DEFAULT 0,
  ventas_mm_sql numeric DEFAULT 0,
  meta numeric DEFAULT 0,
  ventas numeric DEFAULT 0,
  acv_f numeric DEFAULT 0,
  director text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(asesor, anio_mes)
);

ALTER TABLE public.productividad_asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view productividad_asesores"
  ON public.productividad_asesores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage productividad_asesores"
  ON public.productividad_asesores FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
