
CREATE OR REPLACE FUNCTION public.sp_convencion_vn_gerentes(p_anio int DEFAULT 2026)
RETURNS TABLE(gerente_id uuid, nombre text, pais text, canal text, celula text, sp_convencion numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  gers AS (
    SELECT g.id, g.nombre, g.pais, g.canal, g.celula,
           lower(regexp_replace(unaccent(coalesce(g.nombre,'')), '\s+', ' ', 'g')) AS nombre_n,
           lower(regexp_replace(unaccent(coalesce(g.celula,'')), '\s+', ' ', 'g')) AS celula_n,
           (g.lider IS NULL OR btrim(g.lider) = '') AS is_leader
    FROM public.gerentes g
    WHERE g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
      AND NOT (g.pais='MEX' AND g.canal='VC')
      AND coalesce(g.activo, true)
  ),
  metas_raw AS (
    SELECT
      lower(regexp_replace(unaccent(coalesce(m.celula,'')), '\s+', ' ', 'g')) AS celula_n,
      (p_anio::text ||
        CASE lower(substr(trim(coalesce(m.mes,'')),1,3))
          WHEN 'ene' THEN '01' WHEN 'feb' THEN '02' WHEN 'mar' THEN '03'
          WHEN 'abr' THEN '04' WHEN 'may' THEN '05' WHEN 'jun' THEN '06'
          WHEN 'jul' THEN '07' WHEN 'ago' THEN '08' WHEN 'sep' THEN '09'
          WHEN 'oct' THEN '10' WHEN 'nov' THEN '11' WHEN 'dic' THEN '12'
          ELSE NULL END) AS periodo,
      coalesce(m.meta_fe,0)::numeric AS meta_fe,
      coalesce(m.meta_nube,0)::numeric AS meta_nube,
      coalesce(m.meta_total_acv,0)::numeric AS meta_acv,
      (lower(coalesce(m.archivo,'')) LIKE '%cierre%') AS is_cierre
    FROM public.metas_acv_gerentes m
  ),
  metas_ranked AS (
    SELECT celula_n, periodo, meta_fe, meta_nube, meta_acv,
           ROW_NUMBER() OVER (PARTITION BY celula_n, periodo ORDER BY is_cierre DESC) AS rn
    FROM metas_raw WHERE periodo IS NOT NULL
  ),
  metas AS (
    SELECT celula_n, periodo, meta_fe, meta_nube, meta_acv FROM metas_ranked WHERE rn = 1
  ),
  vgm_year AS (
    SELECT
      lower(regexp_replace(unaccent(coalesce(v.gerente_normalizado, v.gerente,'')), '\s+', ' ', 'g')) AS gerente_n,
      lower(regexp_replace(unaccent(coalesce(v.celula,'')), '\s+', ' ', 'g')) AS celula_n,
      v.periodo::text AS periodo,
      upper(coalesce(v.familia,'')) AS familia,
      round(coalesce(v.unidades,0))::numeric AS unidades,
      round(coalesce(v.acv,0))::numeric AS acv
    FROM public.ventas_gerente_mensual v
    WHERE v.periodo::text LIKE p_anio::text || '%'
  ),
  vgm_dedup_gerente AS (
    SELECT DISTINCT gerente_n, periodo, familia, unidades, acv FROM vgm_year
  ),
  ventas_by_gerente AS (
    SELECT gerente_n, periodo,
           SUM(CASE WHEN familia='FE' THEN unidades ELSE 0 END) AS ventas_fe,
           SUM(CASE WHEN familia='NUBE' THEN unidades ELSE 0 END) AS ventas_nube,
           SUM(acv) AS acv_total
    FROM vgm_dedup_gerente GROUP BY gerente_n, periodo
  ),
  gerentes_con_ventas AS (
    SELECT DISTINCT gerente_n FROM vgm_year WHERE gerente_n <> ''
  ),
  vgm_dedup_celula AS (
    SELECT DISTINCT celula_n, periodo, familia, unidades, acv FROM vgm_year
  ),
  ventas_by_celula AS (
    SELECT celula_n, periodo,
           SUM(CASE WHEN familia='FE' THEN unidades ELSE 0 END) AS ventas_fe,
           SUM(CASE WHEN familia='NUBE' THEN unidades ELSE 0 END) AS ventas_nube,
           SUM(acv) AS acv_total
    FROM vgm_dedup_celula GROUP BY celula_n, periodo
  ),
  ventas_g AS (
    SELECT g.id AS gid,
           COALESCE(vg.periodo, vc.periodo) AS periodo,
           COALESCE(vg.ventas_fe, vc.ventas_fe, 0) AS ventas_fe,
           COALESCE(vg.ventas_nube, vc.ventas_nube, 0) AS ventas_nube,
           COALESCE(vg.acv_total, vc.acv_total, 0) AS acv_total
    FROM gers g
    LEFT JOIN ventas_by_gerente vg
      ON vg.gerente_n = g.nombre_n
     AND EXISTS (SELECT 1 FROM gerentes_con_ventas gv WHERE gv.gerente_n = g.nombre_n)
    LEFT JOIN ventas_by_celula vc
      ON vc.celula_n = g.celula_n
     AND NOT EXISTS (SELECT 1 FROM gerentes_con_ventas gv WHERE gv.gerente_n = g.nombre_n)
    WHERE g.is_leader
  ),
  ventas_final AS (
    SELECT gid, periodo, ventas_fe, ventas_nube, acv_total FROM ventas_g WHERE periodo IS NOT NULL
  ),
  metas_g AS (
    SELECT g.id AS gid, m.periodo, m.meta_fe, m.meta_nube, m.meta_acv
    FROM gers g JOIN metas m ON m.celula_n = g.celula_n
    WHERE m.periodo LIKE p_anio::text || '%'
      AND g.is_leader
  ),
  combined AS (
    SELECT gid, periodo FROM ventas_final
    UNION
    SELECT gid, periodo FROM metas_g
  ),
  calc AS (
    SELECT c.gid, c.periodo,
           COALESCE(v.ventas_fe,0) AS ventas_fe,
           COALESCE(v.ventas_nube,0) AS ventas_nube,
           COALESCE(v.acv_total,0) AS acv_total,
           COALESCE(mm.meta_fe,0) AS meta_fe,
           COALESCE(mm.meta_nube,0) AS meta_nube,
           COALESCE(mm.meta_acv,0) AS meta_acv
    FROM combined c
    LEFT JOIN ventas_final v ON v.gid=c.gid AND v.periodo=c.periodo
    LEFT JOIN metas_g mm ON mm.gid=c.gid AND mm.periodo=c.periodo
  ),
  sp_mes AS (
    SELECT gid,
      (CASE WHEN meta_fe>0   THEN LEAST(300, GREATEST(0, round(ventas_fe/meta_fe*100)))   ELSE 0 END)
    + (CASE WHEN meta_nube>0 THEN LEAST(300, GREATEST(0, round(ventas_nube/meta_nube*100))) ELSE 0 END) * 2
    + (CASE WHEN meta_acv>0  THEN LEAST(300, GREATEST(0, round(acv_total/meta_acv*100)))  ELSE 0 END)
      AS sp
    FROM calc WHERE periodo LIKE p_anio::text || '%'
  ),
  totals AS (
    SELECT gid, SUM(sp)::numeric AS sp_total FROM sp_mes GROUP BY gid
  )
  SELECT g.id, g.nombre, g.pais, g.canal, g.celula,
         COALESCE(t.sp_total, 0)::numeric AS sp_convencion
  FROM gers g LEFT JOIN totals t ON t.gid = g.id;
END;
$$;
