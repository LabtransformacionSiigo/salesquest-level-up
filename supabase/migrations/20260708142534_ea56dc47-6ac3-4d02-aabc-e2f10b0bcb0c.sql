
CREATE OR REPLACE VIEW public.desglose_producto_vc AS
WITH gerentes_por_nombre AS (
  -- Mapea cada gerente_id a la lista completa de gerente_id que comparten nombre+canal VC
  SELECT
    g.id AS gerente_id,
    g.nombre,
    ARRAY(
      SELECT g2.id
      FROM public.gerentes g2
      WHERE g2.canal = 'VC' AND g2.nombre = g.nombre
    ) AS sibling_ids
  FROM public.gerentes g
  WHERE g.canal = 'VC'
),
has_prod AS (
  SELECT DISTINCT v.gerente_id, v.mes, v.anio
  FROM public.ventas v
  WHERE v.canal = 'VC' AND v.documento_factura LIKE 'PROD-%'
),
prod_rows AS (
  SELECT
    gpn.gerente_id,
    COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría') AS producto,
    v.anio,
    v.mes,
    SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
    COUNT(*) AS unidades
  FROM gerentes_por_nombre gpn
  JOIN public.ventas v ON v.gerente_id = ANY(gpn.sibling_ids)
  WHERE v.canal = 'VC' AND v.documento_factura LIKE 'PROD-%'
  GROUP BY gpn.gerente_id, COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría'), v.anio, v.mes
),
detail_rows AS (
  SELECT
    gpn.gerente_id,
    COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría') AS producto,
    v.anio,
    v.mes,
    SUM(COALESCE(v.acv_plus, 0)) AS acv_total,
    COUNT(*) AS unidades
  FROM gerentes_por_nombre gpn
  JOIN public.ventas v ON v.gerente_id = ANY(gpn.sibling_ids)
  WHERE v.canal = 'VC'
    AND v.documento_factura NOT LIKE 'SUM-%'
    AND v.documento_factura NOT LIKE 'PROD-%'
    AND v.categoria_producto_venta IS NOT NULL
    AND v.categoria_producto_venta <> ''
    AND NOT EXISTS (
      SELECT 1 FROM has_prod hp
      WHERE hp.gerente_id = ANY(gpn.sibling_ids)
        AND hp.mes = v.mes AND hp.anio = v.anio
    )
  GROUP BY gpn.gerente_id, COALESCE(NULLIF(v.categoria_producto_venta, ''), NULLIF(v.producto, ''), 'Sin categoría'), v.anio, v.mes
)
SELECT gerente_id, producto, anio, mes, acv_total, unidades FROM prod_rows
UNION ALL
SELECT gerente_id, producto, anio, mes, acv_total, unidades FROM detail_rows;

GRANT SELECT ON public.desglose_producto_vc TO authenticated, anon, service_role;
