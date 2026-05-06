-- Sincroniza gerentes.sp_canje con la suma real de sp_acumulados (tipo_sp = canje)
WITH totales AS (
  SELECT gerente_id, COALESCE(SUM(sp),0) AS total
  FROM sp_acumulados
  WHERE tipo_sp = 'canje'
  GROUP BY gerente_id
)
UPDATE gerentes g
SET sp_canje = GREATEST(t.total, g.sp_canje)
FROM totales t
WHERE g.id = t.gerente_id
  AND t.total > COALESCE(g.sp_canje, 0);