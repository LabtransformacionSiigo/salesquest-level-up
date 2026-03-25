
DROP VIEW IF EXISTS public.ranking_general;

CREATE VIEW public.ranking_general AS
SELECT
  g.id,
  g.nombre,
  g.canal,
  g.pais,
  COALESCE(SUM(s.sp), 0)::INTEGER AS sp_totales,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 6001 THEN 'Diamante'
    WHEN COALESCE(SUM(s.sp),0) >= 4501 THEN 'Esmeralda'
    WHEN COALESCE(SUM(s.sp),0) >= 3001 THEN 'Zafiro'
    WHEN COALESCE(SUM(s.sp),0) >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END AS nivel,
  g.avatar_url,
  g.user_id,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(s.sp),0) DESC) AS posicion,
  ROW_NUMBER() OVER (PARTITION BY g.canal ORDER BY COALESCE(SUM(s.sp),0) DESC) AS posicion_canal
FROM gerentes g
LEFT JOIN sp_acumulados s ON g.id = s.gerente_id
WHERE g.activo = true
GROUP BY g.id, g.nombre, g.canal, g.pais, g.avatar_url, g.user_id;

-- Update sp_totales_gerente with new levels (column order already matches)
CREATE OR REPLACE VIEW public.sp_totales_gerente AS
SELECT
  g.id,
  g.nombre,
  g.canal,
  g.pais,
  g.lider,
  g.activo,
  g.avatar_url,
  g.user_id,
  COALESCE(SUM(s.sp), 0)::INTEGER AS sp_totales,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 6001 THEN 'Diamante'
    WHEN COALESCE(SUM(s.sp),0) >= 4501 THEN 'Esmeralda'
    WHEN COALESCE(SUM(s.sp),0) >= 3001 THEN 'Zafiro'
    WHEN COALESCE(SUM(s.sp),0) >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END AS nivel,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 6001 THEN 6001
    WHEN COALESCE(SUM(s.sp),0) >= 4501 THEN 4501
    WHEN COALESCE(SUM(s.sp),0) >= 3001 THEN 3001
    WHEN COALESCE(SUM(s.sp),0) >= 1501 THEN 1501
    ELSE 0
  END AS sp_nivel_actual,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 6001 THEN NULL::INTEGER
    WHEN COALESCE(SUM(s.sp),0) >= 4501 THEN 6001
    WHEN COALESCE(SUM(s.sp),0) >= 3001 THEN 4501
    WHEN COALESCE(SUM(s.sp),0) >= 1501 THEN 3001
    ELSE 1501
  END AS sp_siguiente_nivel
FROM gerentes g
LEFT JOIN sp_acumulados s ON g.id = s.gerente_id
GROUP BY g.id, g.nombre, g.canal, g.pais, g.lider, g.activo, g.avatar_url, g.user_id;
