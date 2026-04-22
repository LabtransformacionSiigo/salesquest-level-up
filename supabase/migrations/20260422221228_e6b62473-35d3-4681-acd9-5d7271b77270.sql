
-- Recálculo SP Convención VN: %FE + 2×%NUBE + %ACV mensual
-- FE/NUBE: ventas reales / metas asesores activos (sin novedad), fallback a metas_gerentes
-- ACV: productividad asesores activos / (meta × 1M), fallback a metas_gerentes
-- Resultado se asigna a TODOS los gerentes activos de la célula

DO $$
DECLARE
  rec RECORD;
  v_total INTEGER;
BEGIN
  -- 1) Limpiar SP convención VN previo
  DELETE FROM sp_acumulados
  WHERE tipo_sp = 'convencion'
    AND gerente_id IN (SELECT id FROM gerentes WHERE canal IN ('VN_ALIADOS','VN_EMPRESARIOS'));

  -- 2) Calcular SP por célula y mes
  FOR rec IN
    WITH activos AS (
      SELECT anio_mes, celula, lower(nombre_asesor) AS nm,
             COALESCE(meta_fe,0) AS meta_fe, COALESCE(meta_nube,0) AS meta_nube
      FROM metas_asesores
      WHERE COALESCE(novedad,'') IN ('','Sin novedad')
        AND celula IS NOT NULL
    ),
    metas_team_asesor AS (
      SELECT anio_mes, celula,
             SUM(meta_fe) AS meta_fe, SUM(meta_nube) AS meta_nube
      FROM activos GROUP BY anio_mes, celula
    ),
    metas_gerente AS (
      SELECT celula,
             SUM(COALESCE(fe,0)) AS meta_fe,
             SUM(COALESCE(nube,0)) AS meta_nube,
             SUM(COALESCE(meta_total_acv,0)) AS meta_acv
      FROM metas_gerentes
      WHERE canal_direccion IN ('Aliados','Empresarios')
      GROUP BY celula
    ),
    ventas_team AS (
      SELECT TO_CHAR(MAKE_DATE(anio,mes,1),'YYYYMM') AS anio_mes, celula,
        SUM(CASE WHEN familia='FE' THEN unidades ELSE 0 END) AS uds_fe,
        SUM(CASE WHEN familia='NUBE' THEN unidades ELSE 0 END) AS uds_nube,
        SUM(acv) AS acv_total
      FROM ventas_gerente_mensual
      WHERE canal_direccion IN ('Aliados','Empresarios') AND celula IS NOT NULL
      GROUP BY anio, mes, celula
    ),
    acv_team_asesor AS (
      SELECT p.anio_mes, p.celula,
             SUM(p.acv_f) AS acv,
             SUM(p.meta) * 1000000 AS meta_acv
      FROM productividad_asesores p
      JOIN activos a ON a.anio_mes=p.anio_mes AND a.celula=p.celula AND a.nm=lower(p.asesor)
      GROUP BY p.anio_mes, p.celula
    ),
    consolidado AS (
      SELECT
        v.anio_mes, v.celula,
        v.uds_fe, v.uds_nube, v.acv_total,
        COALESCE(NULLIF(mta.meta_fe,0), mg.meta_fe, 0) AS meta_fe,
        COALESCE(NULLIF(mta.meta_nube,0), mg.meta_nube, 0) AS meta_nube,
        COALESCE(NULLIF(ata.meta_acv,0), mg.meta_acv, 0) AS meta_acv,
        COALESCE(ata.acv, v.acv_total) AS acv_efectivo
      FROM ventas_team v
      LEFT JOIN metas_team_asesor mta ON mta.anio_mes=v.anio_mes AND mta.celula=v.celula
      LEFT JOIN acv_team_asesor ata ON ata.anio_mes=v.anio_mes AND ata.celula=v.celula
      LEFT JOIN metas_gerente mg ON mg.celula=v.celula
    )
    SELECT
      anio_mes, celula,
      LEAST(300, COALESCE(ROUND(uds_fe::numeric * 100 / NULLIF(meta_fe,0)),0))::int AS pct_fe,
      LEAST(300, COALESCE(ROUND(uds_nube::numeric * 100 / NULLIF(meta_nube,0)),0))::int AS pct_nube,
      LEAST(300, COALESCE(ROUND(acv_efectivo * 100 / NULLIF(meta_acv,0)),0))::int AS pct_acv
    FROM consolidado
    WHERE meta_fe > 0 OR meta_nube > 0 OR meta_acv > 0
  LOOP
    v_total := rec.pct_fe + (rec.pct_nube * 2) + rec.pct_acv;
    IF v_total > 0 THEN
      INSERT INTO sp_acumulados (gerente_id, periodo, sp, fuente, detalle, tipo_sp)
      SELECT g.id, rec.anio_mes, v_total, 'CUMPLIMIENTO_META',
             'Cumplimiento ' || rec.celula || ' (' || rec.pct_fe || '%FE+' || rec.pct_nube || '%N×2+' || rec.pct_acv || '%ACV)',
             'convencion'
      FROM gerentes g
      WHERE g.celula = rec.celula
        AND g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
        AND COALESCE(g.activo,true) = true;
    END IF;
  END LOOP;

  -- 3) Refrescar gerentes.sp_convencion
  UPDATE gerentes g SET sp_convencion = COALESCE(sub.tot,0)
  FROM (
    SELECT gerente_id, SUM(sp) AS tot
    FROM sp_acumulados WHERE tipo_sp='convencion' GROUP BY gerente_id
  ) sub
  WHERE g.id = sub.gerente_id AND g.canal IN ('VN_ALIADOS','VN_EMPRESARIOS');

  UPDATE gerentes SET sp_convencion = 0
  WHERE canal IN ('VN_ALIADOS','VN_EMPRESARIOS')
    AND id NOT IN (SELECT DISTINCT gerente_id FROM sp_acumulados WHERE tipo_sp='convencion' AND gerente_id IS NOT NULL);
END $$;
