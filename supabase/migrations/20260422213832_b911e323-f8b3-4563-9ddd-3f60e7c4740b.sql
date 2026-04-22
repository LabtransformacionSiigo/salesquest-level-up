DELETE FROM sp_acumulados
WHERE tipo_sp = 'convencion'
  AND gerente_id IN (SELECT id FROM gerentes WHERE canal IN ('VN_ALIADOS','VN_EMPRESARIOS'));

WITH ventas_celula AS (
  SELECT periodo, celula,
         SUM(CASE WHEN familia = 'FE'   THEN unidades ELSE 0 END) AS uds_fe,
         SUM(CASE WHEN familia = 'NUBE' THEN unidades ELSE 0 END) AS uds_nube,
         SUM(acv) AS acv_total
  FROM ventas_gerente_mensual
  WHERE celula IS NOT NULL
  GROUP BY periodo, celula
),
metas_celula AS (
  SELECT celula,
         COALESCE(MAX(fe),0) AS meta_fe,
         COALESCE(MAX(nube),0) AS meta_nube,
         COALESCE(MAX(meta_total_acv),0) AS meta_acv
  FROM metas_gerentes
  GROUP BY celula
),
sp_calc AS (
  SELECT v.periodo, v.celula,
         LEAST(300, CASE WHEN m.meta_fe>0   THEN ROUND(v.uds_fe::numeric*100/m.meta_fe)     ELSE 0 END) AS pct_fe,
         LEAST(300, CASE WHEN m.meta_nube>0 THEN ROUND(v.uds_nube::numeric*100/m.meta_nube) ELSE 0 END) AS pct_nube,
         LEAST(300, CASE WHEN m.meta_acv>0  THEN ROUND(v.acv_total*100/m.meta_acv)          ELSE 0 END) AS pct_acv
  FROM ventas_celula v
  JOIN metas_celula m ON m.celula = v.celula
)
INSERT INTO sp_acumulados (gerente_id, periodo, sp, fuente, detalle, tipo_sp)
SELECT g.id, s.periodo, (s.pct_fe + s.pct_acv + s.pct_nube*2)::int,
       'CUMPLIMIENTO_META', 'Cumplimiento célula ' || s.celula, 'convencion'
FROM sp_calc s
JOIN gerentes g ON g.celula = s.celula
WHERE g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
  AND g.activo = true
  AND (s.pct_fe + s.pct_acv + s.pct_nube*2) > 0;

UPDATE gerentes g SET sp_convencion = COALESCE((
  SELECT SUM(sp) FROM sp_acumulados WHERE gerente_id = g.id AND tipo_sp = 'convencion'
),0)
WHERE g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS');