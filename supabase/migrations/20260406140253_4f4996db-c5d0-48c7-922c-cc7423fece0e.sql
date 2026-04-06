
-- Helper function to get current month name in Spanish
CREATE OR REPLACE FUNCTION public.mes_actual_nombre()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT CASE EXTRACT(MONTH FROM CURRENT_DATE)::int
    WHEN 1 THEN 'Enero'
    WHEN 2 THEN 'Febrero'
    WHEN 3 THEN 'Marzo'
    WHEN 4 THEN 'Abril'
    WHEN 5 THEN 'Mayo'
    WHEN 6 THEN 'Junio'
    WHEN 7 THEN 'Julio'
    WHEN 8 THEN 'Agosto'
    WHEN 9 THEN 'Septiembre'
    WHEN 10 THEN 'Octubre'
    WHEN 11 THEN 'Noviembre'
    WHEN 12 THEN 'Diciembre'
  END
$$;

-- Recreate ranking_vc_gerentes with dynamic year/month
CREATE OR REPLACE VIEW ranking_vc_gerentes AS
SELECT
  v.gerente_id,
  g.nombre,
  g.pais,
  v.mes,
  SUM(v.acv_plus) AS acv_total,
  SUM(v.meta) AS meta_total,
  CASE WHEN SUM(v.meta) > 0 THEN ROUND(SUM(v.acv_plus) / SUM(v.meta) * 100, 2) ELSE 0 END AS pct_cumplimiento,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN SUM(v.meta) > 0 THEN SUM(v.acv_plus) / SUM(v.meta) ELSE 0 END DESC,
             SUM(v.acv_plus) DESC
  ) AS posicion
FROM ventas v
JOIN gerentes g ON g.id = v.gerente_id
WHERE v.canal = 'VC'
  AND v.documento_factura LIKE 'SUM-%'
  AND v.meta > 0
  AND v.anio = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND v.mes = mes_actual_nombre()
GROUP BY v.gerente_id, g.nombre, g.pais, v.mes
ORDER BY pct_cumplimiento DESC;

-- Recreate ranking_vc_comerciales with dynamic year/month
CREATE OR REPLACE VIEW ranking_vc_comerciales AS
SELECT
  v.comercial AS nombre,
  v.lider AS gerente_nombre,
  v.acv_plus AS acv_total,
  v.meta AS meta_total,
  CASE WHEN v.meta > 0 THEN ROUND(v.acv_plus / v.meta * 100, 2) ELSE 0 END AS pct_cumplimiento,
  0::bigint AS ventas_count,
  ROW_NUMBER() OVER (
    ORDER BY CASE WHEN v.meta > 0 THEN v.acv_plus / v.meta ELSE 0 END DESC,
             v.acv_plus DESC
  ) AS posicion
FROM ventas v
WHERE v.canal = 'VC'
  AND v.documento_factura LIKE 'SUM-%'
  AND v.meta > 0
  AND v.comercial IS NOT NULL
  AND v.comercial <> ''
  AND v.anio = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND v.mes = mes_actual_nombre()
ORDER BY pct_cumplimiento DESC;

-- Also update acv_vc_mensual to use dynamic current month
CREATE OR REPLACE VIEW acv_vc_mensual AS
SELECT
  g.id AS gerente_id,
  g.nombre,
  v.mes,
  v.anio,
  SUM(COALESCE(v.acv_plus, 0)) AS acv_plus_total,
  COUNT(v.documento_factura) AS unidades,
  SUM(COALESCE(v.valor_producto, 0)) AS valor_total,
  SUM(COALESCE(v.meta, 0)) AS meta_total,
  SUM(CASE WHEN v.bloque_venta = 'Nomina-e' THEN COALESCE(v.acv_plus, 0) ELSE 0 END) AS acv_nomina,
  SUM(CASE WHEN v.bloque_venta = 'FE' THEN COALESCE(v.acv_plus, 0) ELSE 0 END) AS acv_fe,
  SUM(CASE WHEN v.bloque_venta = 'Conversiones' THEN COALESCE(v.acv_plus, 0) ELSE 0 END) AS acv_conversiones
FROM gerentes g
LEFT JOIN ventas v ON g.id = v.gerente_id AND v.canal = 'VC' AND v.documento_factura LIKE 'SUM-%'
WHERE g.canal = 'VC'
GROUP BY g.id, g.nombre, v.mes, v.anio;
