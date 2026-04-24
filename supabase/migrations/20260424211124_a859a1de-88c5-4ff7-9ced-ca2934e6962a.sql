-- Tabla optimizada VN: una sola fuente para SP, rankings y dashboards.
-- Reemplaza el cruce manual (productividad + ejecucion + ventas_gerente_mensual)
-- por el resultado pre-agregado de Databricks (consultas A/B/C).

CREATE TABLE IF NOT EXISTS public.vn_metricas_optimizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pais TEXT NOT NULL,                  -- COL, ECU, URU, MEX
  mes_nro SMALLINT NOT NULL,           -- 1..12
  anio SMALLINT NOT NULL DEFAULT 2026,
  periodo TEXT GENERATED ALWAYS AS (anio::text || lpad(mes_nro::text, 2, '0')) STORED,
  canal_direccion TEXT NOT NULL,       -- Aliados | Empresarios
  gerente TEXT,
  gerente_normalizado TEXT,
  celula TEXT,
  asesor TEXT,                         -- NULL en agregados gerente-only (consulta A)
  tipo_producto1 TEXT NOT NULL,
  familia TEXT,                        -- FE | NUBE | CONTADOR | OTRO
  ventas BIGINT NOT NULL DEFAULT 0,
  acv_total BIGINT NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'asesor',-- 'gerente' (consulta A) | 'asesor' (B/C)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vn_metricas_periodo ON public.vn_metricas_optimizadas(periodo);
CREATE INDEX IF NOT EXISTS idx_vn_metricas_canal ON public.vn_metricas_optimizadas(canal_direccion);
CREATE INDEX IF NOT EXISTS idx_vn_metricas_gerente ON public.vn_metricas_optimizadas(gerente_normalizado);
CREATE INDEX IF NOT EXISTS idx_vn_metricas_celula ON public.vn_metricas_optimizadas(celula);
CREATE INDEX IF NOT EXISTS idx_vn_metricas_scope ON public.vn_metricas_optimizadas(scope);

-- Clave única para upsert idempotente desde la edge function
CREATE UNIQUE INDEX IF NOT EXISTS uq_vn_metricas_grano
  ON public.vn_metricas_optimizadas(
    pais, periodo, canal_direccion, scope,
    COALESCE(gerente_normalizado, ''),
    COALESCE(asesor, ''),
    tipo_producto1
  );

ALTER TABLE public.vn_metricas_optimizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vn_metricas_optimizadas"
  ON public.vn_metricas_optimizadas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage vn_metricas_optimizadas"
  ON public.vn_metricas_optimizadas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vn_metricas_updated_at
  BEFORE UPDATE ON public.vn_metricas_optimizadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();