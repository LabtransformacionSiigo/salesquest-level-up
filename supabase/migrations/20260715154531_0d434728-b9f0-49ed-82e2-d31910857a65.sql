
CREATE OR REPLACE FUNCTION public.gamificacion_uso_stats(desde date DEFAULT '2026-04-01'::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cuentas int;
  v_logueados int;
  v_activos30d int;
  v_gerentes_cuentas int;
  v_gerentes_logueados int;
  v_por_mes jsonb;
  v_top_uso jsonb;
  v_por_canal_pais jsonb;
  v_retos jsonb;
  v_sp_canje jsonb;
  v_sp_convencion jsonb;
  v_canjes jsonb;
  v_directores jsonb;
  v_resumen_sp jsonb;
  v_detalle jsonb;
  v_ranking_oficial jsonb;
  v_uso_detalle jsonb;
  v_retos_diag jsonb;
BEGIN
  SELECT count(*) INTO v_cuentas FROM auth.users;
  SELECT count(*) INTO v_logueados FROM auth.users WHERE last_sign_in_at IS NOT NULL;
  SELECT count(*) INTO v_activos30d FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days';

  SELECT count(*) INTO v_gerentes_cuentas
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM public.gerentes g
    WHERE g.user_id = u.id AND NOT (g.pais='MEX' AND g.canal='VC')
  );

  SELECT count(*) INTO v_gerentes_logueados
  FROM auth.users u
  WHERE u.last_sign_in_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.gerentes g
      WHERE g.user_id = u.id AND NOT (g.pais='MEX' AND g.canal='VC')
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.mes), '[]'::jsonb) INTO v_por_mes
  FROM (
    SELECT to_char(date_trunc('month', rt.created_at), 'YYYY-MM') AS mes,
           count(DISTINCT rt.user_id) AS usuarios_activos,
           count(*) AS eventos
    FROM auth.refresh_tokens rt
    WHERE rt.created_at >= desde
    GROUP BY 1
  ) t;

  WITH led AS (
    SELECT gerente_id, COALESCE(SUM(sp),0)::int AS total
    FROM public.sp_acumulados GROUP BY gerente_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.dias_activos DESC), '[]'::jsonb) INTO v_top_uso
  FROM (
    SELECT g.nombre, g.pais, g.canal,
           count(DISTINCT rt.created_at::date) AS dias_activos,
           max(rt.created_at)::date AS ultima_actividad,
           COALESCE(max(led.total),0) AS sp
    FROM auth.refresh_tokens rt
    JOIN public.gerentes g ON g.user_id::text = rt.user_id::text
    LEFT JOIN led ON led.gerente_id = g.id
    WHERE rt.created_at >= desde
      AND NOT (g.pais='MEX' AND g.canal='VC')
    GROUP BY g.nombre, g.pais, g.canal
    ORDER BY dias_activos DESC
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_canal_pais
  FROM (
    SELECT g.pais, g.canal,
           count(*) AS cuentas,
           count(*) FILTER (WHERE u.last_sign_in_at IS NOT NULL) AS logueados,
           count(*) FILTER (WHERE u.last_sign_in_at >= now() - interval '30 days') AS activos30d
    FROM public.gerentes g
    JOIN auth.users u ON u.id = g.user_id
    WHERE NOT (g.pais='MEX' AND g.canal='VC')
    GROUP BY g.pais, g.canal
    ORDER BY g.pais, g.canal
  ) t;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.retos_completados),
    'usuarios', (SELECT count(DISTINCT gerente_id) FROM public.retos_completados),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT g.nombre, g.pais, g.canal,
               count(*) AS retos,
               COALESCE(sum(r.sp),0) AS sp,
               max(r.fecha) AS ultimo
        FROM public.retos_completados r
        JOIN public.gerentes g ON g.id = r.gerente_id
        WHERE NOT (g.pais='MEX' AND g.canal='VC')
        GROUP BY g.nombre, g.pais, g.canal
        ORDER BY retos DESC LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_retos;

  WITH led AS (
    SELECT gerente_id, COALESCE(SUM(sp) FILTER (WHERE tipo_sp='canje'),0)::int AS canje
    FROM public.sp_acumulados GROUP BY gerente_id
  )
  SELECT jsonb_build_object(
    'conSaldo', (SELECT count(DISTINCT g.id) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE led.canje>0 AND NOT (g.pais='MEX' AND g.canal='VC')),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT g.nombre, g.pais, g.canal, led.canje AS sp
        FROM public.gerentes g JOIN led ON led.gerente_id=g.id
        WHERE led.canje>0 AND NOT (g.pais='MEX' AND g.canal='VC')
        ORDER BY led.canje DESC LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_canje;

  WITH led AS (
    SELECT gerente_id, COALESCE(SUM(sp) FILTER (WHERE tipo_sp='convencion'),0)::int AS conv
    FROM public.sp_acumulados GROUP BY gerente_id
  )
  SELECT jsonb_build_object(
    'conPuntos', (SELECT count(DISTINCT g.id) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE led.conv>0 AND NOT (g.pais='MEX' AND g.canal='VC')),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT g.nombre, g.pais, g.canal, led.conv AS sp
        FROM public.gerentes g JOIN led ON led.gerente_id=g.id
        WHERE led.conv>0 AND NOT (g.pais='MEX' AND g.canal='VC')
        ORDER BY led.conv DESC LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_convencion;

  WITH led AS (
    SELECT gerente_id,
           COALESCE(SUM(sp) FILTER (WHERE tipo_sp='canje'),0)::int AS canje,
           COALESCE(SUM(sp) FILTER (WHERE tipo_sp='convencion'),0)::int AS conv,
           COALESCE(SUM(sp),0)::int AS total
    FROM public.sp_acumulados GROUP BY gerente_id
  )
  SELECT jsonb_build_object(
    'conSpTotal', (SELECT count(DISTINCT g.id) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE led.total>0 AND NOT (g.pais='MEX' AND g.canal='VC')),
    'conCanje', (SELECT count(DISTINCT g.id) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE led.canje>0 AND NOT (g.pais='MEX' AND g.canal='VC')),
    'conConvencion', (SELECT count(DISTINCT g.id) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE led.conv>0 AND NOT (g.pais='MEX' AND g.canal='VC')),
    'spTotalGlobal', (SELECT COALESCE(SUM(led.total),0) FROM public.gerentes g JOIN led ON led.gerente_id=g.id WHERE NOT (g.pais='MEX' AND g.canal='VC'))
  ) INTO v_resumen_sp;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.canjes),
    'porEstado', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT estado, count(*) AS n, COALESCE(sum(puntos_gastados),0) AS sp
        FROM public.canjes GROUP BY estado
      ) t
    ), '[]'::jsonb)
  ) INTO v_canjes;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_directores
  FROM (
    SELECT d.nombre, d.cargo,
           array_to_json(d.paises) AS paises,
           array_to_json(d.canales) AS canales,
           u.last_sign_in_at AS ultima_sesion,
           u.created_at AS cuenta_creada
    FROM public.directores d
    LEFT JOIN auth.users u ON u.id = d.user_id
    WHERE d.activo
    ORDER BY u.last_sign_in_at DESC NULLS LAST
  ) t;

  v_detalle := jsonb_build_object(
    'porCanalPais', v_por_canal_pais,
    'retos', v_retos,
    'spCanje', v_sp_canje,
    'spConvencion', v_sp_convencion,
    'resumenSp', v_resumen_sp,
    'canjes', v_canjes,
    'directores', v_directores
  );

  -- ============================================================
  -- rankingOficial
  -- ============================================================
  WITH area_map AS (
    SELECT * FROM (VALUES ('VN_ALIADOS','Aliados'),('VN_EMPRESARIOS','Leads Mercadeo Digital')) AS t(canal, area)
  ),
  celulas AS (
    SELECT DISTINCT am.canal, pa.pais,
      lower(regexp_replace(unaccent(coalesce(pa.celula,'')),'\s+',' ','g')) AS celula_n
    FROM productividad_asesores pa
    JOIN area_map am ON am.area = pa.area
    WHERE pa.anio_mes BETWEEN '202601' AND '202612'
      AND coalesce(pa.celula,'') <> ''
  ),
  gerente_by_celula AS (
    SELECT DISTINCT ON (lower(regexp_replace(unaccent(coalesce(celula,'')),'\s+',' ','g')))
      lower(regexp_replace(unaccent(coalesce(celula,'')),'\s+',' ','g')) AS celula_n,
      gerente
    FROM metas_asesores
    WHERE anio_mes LIKE '2026%'
      AND coalesce(gerente,'') NOT IN ('','0')
    ORDER BY lower(regexp_replace(unaccent(coalesce(celula,'')),'\s+',' ','g')), length(gerente) DESC
  ),
  mes_map AS (
    SELECT * FROM (VALUES
      ('ene','01'),('feb','02'),('mar','03'),('abr','04'),('may','05'),('jun','06'),
      ('jul','07'),('ago','08'),('sep','09'),('oct','10'),('nov','11'),('dic','12')
    ) AS m(mes_txt, mm)
  ),
  metas_norm AS (
    SELECT
      lower(regexp_replace(unaccent(coalesce(m.celula,'')),'\s+',' ','g')) AS celula_n,
      '2026'||mm.mm AS periodo,
      COALESCE(m.meta_fe,0)::numeric AS meta_fe,
      COALESCE(m.meta_nube,0)::numeric AS meta_nube,
      COALESCE(m.meta_total_acv,0)::numeric AS meta_acv,
      row_number() OVER (
        PARTITION BY lower(regexp_replace(unaccent(coalesce(m.celula,'')),'\s+',' ','g')), '2026'||mm.mm
        ORDER BY CASE WHEN m.archivo ILIKE '%cierre%' THEN 0 ELSE 1 END
      ) AS rn
    FROM metas_acv_gerentes m
    JOIN mes_map mm ON lower(m.mes) = mm.mes_txt
  ),
  metas_prio AS (
    SELECT celula_n, periodo, meta_fe, meta_nube, meta_acv FROM metas_norm WHERE rn = 1
  ),
  ventas_dedup AS (
    SELECT DISTINCT
      lower(regexp_replace(unaccent(coalesce(celula,'')),'\s+',' ','g')) AS celula_n,
      periodo,
      upper(familia) AS familia,
      round(unidades)::numeric AS und,
      round(acv)::numeric AS acv
    FROM ventas_gerente_mensual
    WHERE periodo LIKE '2026%'
  ),
  ventas_agg AS (
    SELECT celula_n, periodo,
      COALESCE(SUM(und) FILTER (WHERE familia='FE'),0) AS fe,
      COALESCE(SUM(und) FILTER (WHERE familia='NUBE'),0) AS nube,
      COALESCE(SUM(acv),0) AS acv
    FROM ventas_dedup GROUP BY celula_n, periodo
  ),
  sp_por_celula_periodo AS (
    SELECT
      COALESCE(m.celula_n, v.celula_n) AS celula_n,
      COALESCE(LEAST(300::numeric, GREATEST(0::numeric, ROUND(COALESCE(v.fe,0) / NULLIF(m.meta_fe,0) * 100))), 0)
      + COALESCE(LEAST(300::numeric, GREATEST(0::numeric, ROUND(COALESCE(v.nube,0) / NULLIF(m.meta_nube,0) * 100))), 0) * 2
      + COALESCE(LEAST(300::numeric, GREATEST(0::numeric, ROUND(COALESCE(v.acv,0) / NULLIF(m.meta_acv,0) * 100))), 0)
      AS sp_mes
    FROM metas_prio m
    FULL JOIN ventas_agg v ON v.celula_n = m.celula_n AND v.periodo = m.periodo
  ),
  sp_totales AS (
    SELECT celula_n, SUM(sp_mes)::int AS sp FROM sp_por_celula_periodo GROUP BY celula_n
  ),
  vn_ranked AS (
    SELECT c.canal, c.pais, c.celula_n,
      gc.gerente,
      COALESCE(st.sp, 0) AS sp,
      ROW_NUMBER() OVER (PARTITION BY c.canal, c.pais ORDER BY COALESCE(st.sp,0) DESC, c.celula_n) AS pos
    FROM celulas c
    LEFT JOIN gerente_by_celula gc ON gc.celula_n = c.celula_n
    LEFT JOIN sp_totales st ON st.celula_n = c.celula_n
  ),
  vn_top AS (
    SELECT canal, pais,
      COALESCE(jsonb_agg(
        jsonb_build_object('pos', pos, 'gerente', gerente, 'celula', celula_n, 'sp', sp)
        ORDER BY pos
      ) FILTER (WHERE pos <= 10), '[]'::jsonb) AS top
    FROM vn_ranked GROUP BY canal, pais
  ),
  vn_j AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('canal',canal,'pais',pais,'top',top) ORDER BY canal, pais), '[]'::jsonb) AS j
    FROM vn_top
  ),
  vc_r AS (
    SELECT pais, nombre, sp_totales,
      ROW_NUMBER() OVER (PARTITION BY pais ORDER BY sp_totales DESC, nombre) AS pos
    FROM ranking_general
    WHERE canal='VC' AND pais <> 'MEX' AND COALESCE(sp_totales,0) > 0
  ),
  vc_j AS (
    SELECT COALESCE(jsonb_agg(x ORDER BY pais), '[]'::jsonb) AS j FROM (
      SELECT pais, jsonb_build_object(
        'canal','VC','pais',pais,
        'top', COALESCE(jsonb_agg(jsonb_build_object('pos',pos,'gerente',nombre,'sp',sp_totales) ORDER BY pos) FILTER (WHERE pos<=10), '[]'::jsonb)
      ) AS x
      FROM vc_r GROUP BY pais
    ) t
  )
  SELECT jsonb_build_object('vn', (SELECT j FROM vn_j), 'vc', (SELECT j FROM vc_j))
  INTO v_ranking_oficial;

  -- ============================================================
  -- usoDetalle
  -- ============================================================
  WITH act AS (
    SELECT g.id, g.nombre, g.pais, g.canal,
      rt.created_at::date AS f,
      EXTRACT(ISODOW FROM rt.created_at)::int AS dow
    FROM auth.refresh_tokens rt
    JOIN gerentes g ON g.user_id::text = rt.user_id::text
    WHERE rt.created_at >= '2026-04-01'
      AND NOT (g.pais='MEX' AND g.canal='VC')
  ),
  per_user AS (
    SELECT id, nombre, pais, canal,
      COUNT(DISTINCT f) AS dias_activos,
      MAX(f) AS ultima_actividad,
      jsonb_build_array(
        COUNT(DISTINCT f) FILTER (WHERE dow=1),
        COUNT(DISTINCT f) FILTER (WHERE dow=2),
        COUNT(DISTINCT f) FILTER (WHERE dow=3),
        COUNT(DISTINCT f) FILTER (WHERE dow=4),
        COUNT(DISTINCT f) FILTER (WHERE dow=5),
        COUNT(DISTINCT f) FILTER (WHERE dow=6),
        COUNT(DISTINCT f) FILTER (WHERE dow=7)
      ) AS dias_semana
    FROM act GROUP BY id, nombre, pais, canal
  ),
  usuarios_j AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('nombre',nombre,'pais',pais,'canal',canal,
        'dias_activos',dias_activos,'ultima_actividad',ultima_actividad,'dias_semana',dias_semana)
      ORDER BY dias_activos DESC
    ), '[]'::jsonb) AS j
    FROM per_user
  ),
  por_canal_src AS (
    SELECT g.canal, g.id,
      MAX(rt.created_at::date) AS ultima_activ,
      COUNT(DISTINCT rt.created_at::date) AS dias_activos,
      MAX(CASE WHEN rt.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END) AS activo30
    FROM auth.refresh_tokens rt
    JOIN gerentes g ON g.user_id::text = rt.user_id::text
    WHERE rt.created_at >= '2026-04-01'
      AND NOT (g.pais='MEX' AND g.canal='VC')
    GROUP BY g.canal, g.id
  ),
  por_canal_j AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('canal',canal,'usuarios',usuarios,'activos30d',activos30d,'diasPromedio',dias_prom)
      ORDER BY canal
    ), '[]'::jsonb) AS j
    FROM (
      SELECT canal,
        COUNT(DISTINCT id) AS usuarios,
        COALESCE(SUM(activo30),0) AS activos30d,
        ROUND(AVG(dias_activos)::numeric, 1) AS dias_prom
      FROM por_canal_src GROUP BY canal
    ) t
  )
  SELECT jsonb_build_object(
    'usuarios', (SELECT j FROM usuarios_j),
    'porCanal', (SELECT j FROM por_canal_j)
  ) INTO v_uso_detalle;

  -- ============================================================
  -- retosDiagnostico
  -- ============================================================
  SELECT jsonb_build_object(
    'vc', (SELECT jsonb_build_object(
              'completados', count(*),
              'usuarios', count(DISTINCT gerente_id)
           ) FROM public.retos_completados),
    'vnDiario', (SELECT jsonb_build_object(
              'evaluaciones', count(*),
              'cumplidos', count(*) FILTER (WHERE cumple),
              'pct', ROUND(COALESCE(count(*) FILTER (WHERE cumple)::numeric / NULLIF(count(*),0) * 100, 0), 2),
              'avgMetaNubes', ROUND(COALESCE(AVG(meta_diaria_nubes),0)::numeric, 1),
              'avgRealNubes', ROUND(COALESCE(AVG(nubes_vendidas),0)::numeric, 1),
              'ultimaEvaluacion', MAX(evaluado_at)::date
           ) FROM public.retos_vn_progreso_diario),
    'vnSemanal', (SELECT jsonb_build_object(
              'evaluaciones', count(*),
              'cumplidos', count(*) FILTER (WHERE cumple),
              'pct', ROUND(COALESCE(count(*) FILTER (WHERE cumple)::numeric / NULLIF(count(*),0) * 100, 0), 2),
              'avgPctCumplimiento', ROUND(COALESCE(AVG(pct_cumplimiento),0)::numeric, 1),
              'ultimaEvaluacion', MAX(evaluado_at)::date
           ) FROM public.retos_vn_progreso_semanal),
    'vnMensual', (SELECT jsonb_build_object(
              'evaluaciones', count(*),
              'cumplidos', count(*) FILTER (WHERE cumple),
              'pct', ROUND(COALESCE(count(*) FILTER (WHERE cumple)::numeric / NULLIF(count(*),0) * 100, 0), 2),
              'avgPctCumplimiento', ROUND(COALESCE(AVG(pct_cumplimiento),0)::numeric, 1),
              'ultimaEvaluacion', MAX(evaluado_at)::date
           ) FROM public.retos_vn_progreso_mensual),
    'topCumplidoresVn', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT g.nombre, g.pais, g.canal, count(*) AS cumplidos
        FROM public.retos_vn_progreso_diario r
        JOIN public.gerentes g ON g.id = r.gerente_id
        WHERE r.cumple
        GROUP BY g.nombre, g.pais, g.canal
        ORDER BY count(*) DESC
        LIMIT 8
      ) t
    ), '[]'::jsonb),
    'porPaisDiario', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.pais) FROM (
        SELECT g.pais,
          count(*) AS evaluaciones,
          count(*) FILTER (WHERE r.cumple) AS cumplidos
        FROM public.retos_vn_progreso_diario r
        JOIN public.gerentes g ON g.id = r.gerente_id
        GROUP BY g.pais
      ) t
    ), '[]'::jsonb)
  ) INTO v_retos_diag;

  RETURN jsonb_build_object(
    'cuentas', v_cuentas,
    'logueados', v_logueados,
    'activos30d', v_activos30d,
    'gerentesCuentas', v_gerentes_cuentas,
    'gerentesLogueados', v_gerentes_logueados,
    'porMes', v_por_mes,
    'topUso', v_top_uso,
    'detalle', v_detalle,
    'rankingOficial', v_ranking_oficial,
    'usoDetalle', v_uso_detalle,
    'retosDiagnostico', v_retos_diag
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gamificacion_uso_stats(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacion_uso_stats(date) TO service_role;

COMMENT ON FUNCTION public.gamificacion_uso_stats(date) IS
'Read-only aggregated gamification stats. Extended with rankingOficial (VN via productividad_asesores+metas+ventas replica of app logic; VC via ranking_general excluding MEX), usoDetalle (per-user weekday activity since 2026-04-01), retosDiagnostico (VC/VN daily+weekly+monthly evaluation KPIs). SP tops read from sp_acumulados ledger. Excludes MEX·VC in every gerentes aggregate.';
