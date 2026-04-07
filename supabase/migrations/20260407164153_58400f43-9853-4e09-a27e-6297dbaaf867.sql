
CREATE OR REPLACE VIEW public.sp_totales_gerente WITH (security_invoker = false) AS
SELECT g.id,
    g.nombre,
    g.canal,
    g.pais,
    g.lider,
    g.activo,
    g.avatar_url,
    g.user_id,
    (COALESCE(sum(s.sp), 0))::integer AS sp_totales,
    CASE
        WHEN COALESCE(sum(s.sp), 0) >= 6001 THEN 'Diamante'
        WHEN COALESCE(sum(s.sp), 0) >= 4501 THEN 'Esmeralda'
        WHEN COALESCE(sum(s.sp), 0) >= 3001 THEN 'Zafiro'
        WHEN COALESCE(sum(s.sp), 0) >= 1501 THEN 'Rubí'
        ELSE 'Cuarzo'
    END AS nivel,
    CASE
        WHEN COALESCE(sum(s.sp), 0) >= 6001 THEN 6001
        WHEN COALESCE(sum(s.sp), 0) >= 4501 THEN 4501
        WHEN COALESCE(sum(s.sp), 0) >= 3001 THEN 3001
        WHEN COALESCE(sum(s.sp), 0) >= 1501 THEN 1501
        ELSE 0
    END AS sp_nivel_actual,
    CASE
        WHEN COALESCE(sum(s.sp), 0) >= 6001 THEN NULL::integer
        WHEN COALESCE(sum(s.sp), 0) >= 4501 THEN 6001
        WHEN COALESCE(sum(s.sp), 0) >= 3001 THEN 4501
        WHEN COALESCE(sum(s.sp), 0) >= 1501 THEN 3001
        ELSE 1501
    END AS sp_siguiente_nivel
FROM gerentes g
LEFT JOIN sp_acumulados s ON g.id = s.gerente_id AND s.fuente = 'CUMPLIMIENTO_META'
GROUP BY g.id, g.nombre, g.canal, g.pais, g.lider, g.activo, g.avatar_url, g.user_id;

CREATE OR REPLACE VIEW public.ranking_general WITH (security_invoker = false) AS
SELECT g.id,
    g.nombre,
    g.canal,
    g.pais,
    (COALESCE(sum(s.sp), 0))::integer AS sp_totales,
    CASE
        WHEN COALESCE(sum(s.sp), 0) >= 6001 THEN 'Diamante'
        WHEN COALESCE(sum(s.sp), 0) >= 4501 THEN 'Esmeralda'
        WHEN COALESCE(sum(s.sp), 0) >= 3001 THEN 'Zafiro'
        WHEN COALESCE(sum(s.sp), 0) >= 1501 THEN 'Rubí'
        ELSE 'Cuarzo'
    END AS nivel,
    g.avatar_url,
    g.user_id,
    row_number() OVER (ORDER BY COALESCE(sum(s.sp), 0) DESC) AS posicion,
    row_number() OVER (PARTITION BY g.canal ORDER BY COALESCE(sum(s.sp), 0) DESC) AS posicion_canal
FROM gerentes g
LEFT JOIN sp_acumulados s ON g.id = s.gerente_id AND s.fuente = 'CUMPLIMIENTO_META'
WHERE g.activo = true
GROUP BY g.id, g.nombre, g.canal, g.pais, g.avatar_url, g.user_id;
