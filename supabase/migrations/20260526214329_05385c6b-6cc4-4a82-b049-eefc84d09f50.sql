
WITH ganados AS (
  SELECT gerente_id, SUM(sp)::int AS sp_real
  FROM sp_acumulados WHERE tipo_sp = 'canje'
  GROUP BY gerente_id
),
gastados AS (
  SELECT gerente_id, SUM(puntos_gastados)::int AS gastado
  FROM canjes WHERE estado <> 'rechazado'
  GROUP BY gerente_id
)
UPDATE gerentes g
SET sp_canje = GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
FROM gerentes g2
LEFT JOIN ganados gan ON gan.gerente_id = g2.id
LEFT JOIN gastados gas ON gas.gerente_id = g2.id
WHERE g.id = g2.id;

WITH ganados AS (
  SELECT gerente_id, SUM(sp)::int AS sp_real
  FROM sp_acumulados WHERE tipo_sp = 'canje'
  GROUP BY gerente_id
),
gastados AS (
  SELECT gerente_id, SUM(puntos_gastados)::int AS gastado
  FROM canjes WHERE estado <> 'rechazado'
  GROUP BY gerente_id
)
UPDATE asesores a
SET sp_canje = GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
FROM asesores a2
LEFT JOIN ganados gan ON gan.gerente_id = a2.id
LEFT JOIN gastados gas ON gas.gerente_id = a2.id
WHERE a.id = a2.id;
