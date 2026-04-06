CREATE OR REPLACE VIEW desglose_producto_vc AS
WITH has_prod AS (
  SELECT DISTINCT gerente_id, mes, anio
  FROM ventas
  WHERE canal = 'VC' AND documento_factura LIKE 'PROD-%'
),
prod_rows AS (
  SELECT
    v.gerente_id,
    COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría') AS producto,
    v.anio,
    v.mes,
    SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
    COUNT(*)::bigint AS unidades
  FROM ventas v
  WHERE v.canal = 'VC' AND v.documento_factura LIKE 'PROD-%'
  GROUP BY v.gerente_id, COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría'), v.anio, v.mes
),
detail_rows AS (
  SELECT
    v.gerente_id,
    COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría') AS producto,
    v.anio,
    v.mes,
    SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
    COUNT(*) AS unidades
  FROM ventas v
  WHERE v.canal = 'VC'
    AND v.documento_factura NOT LIKE 'SUM-%'
    AND v.documento_factura NOT LIKE 'PROD-%'
    AND v.categoria_producto_venta IS NOT NULL
    AND v.categoria_producto_venta <> ''
    AND NOT EXISTS (
      SELECT 1 FROM has_prod hp
      WHERE hp.gerente_id = v.gerente_id AND hp.mes = v.mes AND hp.anio = v.anio
    )
  GROUP BY v.gerente_id, COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría'), v.anio, v.mes
)
SELECT * FROM prod_rows
UNION ALL
SELECT * FROM detail_rows;