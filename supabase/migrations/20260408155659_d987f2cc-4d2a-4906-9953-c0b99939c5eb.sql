-- Add new columns to ventas for VN tracking
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS sc_creados_ind integer DEFAULT 1;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS recurrencia text;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS origen text;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS pais text;

-- ============================================================
-- VISTA: ranking_vn_gerentes
-- Ranking mensual de gerentes VN por % cumplimiento de unidades
-- ============================================================
CREATE OR REPLACE VIEW public.ranking_vn_gerentes AS
SELECT
  g.id AS gerente_id,
  g.nombre,
  g.canal,
  g.pais,
  k.anio_mes AS mes_periodo,
  k.ventas AS unidades_logradas,
  k.meta AS meta_unidades,
  k.acv_f AS acv_total,
  CASE
    WHEN k.meta > 0 THEN ROUND(k.ventas::numeric / k.meta * 100, 2)
    ELSE 0
  END AS pct_cumplimiento,
  k.cant_recomendados,
  k.sc_creados,
  ROW_NUMBER() OVER (
    PARTITION BY g.canal, g.pais
    ORDER BY CASE WHEN k.meta > 0 THEN k.ventas::numeric / k.meta ELSE 0 END DESC,
             k.ventas DESC
  ) AS posicion
FROM gerentes g
JOIN kpis_mensuales k ON k.gerente_id = g.id
WHERE g.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND g.activo = true
  AND k.anio_mes = TO_CHAR(CURRENT_DATE, 'YYYYMM')
ORDER BY g.canal, pct_cumplimiento DESC;

-- ============================================================
-- VISTA: ranking_vn_comerciales
-- Ranking de asesores VN por ACV total en ventas del mes actual
-- ============================================================
CREATE OR REPLACE VIEW public.ranking_vn_comerciales AS
SELECT
  v.comercial AS nombre,
  v.lider AS gerente_nombre,
  v.canal,
  v.pais AS pais_gerente,
  SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
  COUNT(*) AS ventas_count,
  SUM(COALESCE(v.sc_creados_ind, 1)) AS unidades_total,
  ROW_NUMBER() OVER (
    PARTITION BY v.canal
    ORDER BY SUM(COALESCE(v.acv_plus, 0)) DESC
  ) AS posicion
FROM ventas v
WHERE v.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND v.anio = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND v.mes = mes_actual_nombre()
  AND v.comercial IS NOT NULL
  AND v.comercial <> ''
GROUP BY v.comercial, v.lider, v.canal, v.pais
ORDER BY v.canal, acv_total DESC;

-- ============================================================
-- VISTA: desglose_producto_vn
-- Desglose de ventas por tipo de producto para gerentes VN
-- ============================================================
CREATE OR REPLACE VIEW public.desglose_producto_vn AS
SELECT
  v.gerente_id,
  COALESCE(NULLIF(v.bloque_venta, ''), NULLIF(v.categoria_producto_venta, ''), 'Otros') AS producto,
  v.canal,
  v.anio,
  v.mes,
  SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
  SUM(COALESCE(v.sc_creados_ind, 1)) AS unidades
FROM ventas v
WHERE v.canal IN ('VN_ALIADOS', 'VN_EMPRESARIOS')
  AND v.comercial IS NOT NULL
  AND v.comercial <> ''
GROUP BY v.gerente_id, COALESCE(NULLIF(v.bloque_venta, ''), NULLIF(v.categoria_producto_venta, ''), 'Otros'), v.canal, v.anio, v.mes;