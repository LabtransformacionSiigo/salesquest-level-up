
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
BEGIN
  -- Ledger materializado como TEMP TABLE (fuente de verdad de SP)
  CREATE TEMP TABLE IF NOT EXISTS _led_tmp ON COMMIT DROP AS
  SELECT gerente_id,
         COALESCE(SUM(sp) FILTER (WHERE tipo_sp='canje'),0)::int      AS canje,
         COALESCE(SUM(sp) FILTER (WHERE tipo_sp='convencion'),0)::int AS conv,
         COALESCE(SUM(sp),0)::int                                     AS total
  FROM public.sp_acumulados
  GROUP BY gerente_id;

  SELECT count(*) INTO v_cuentas FROM auth.users;
  SELECT count(*) INTO v_logueados FROM auth.users WHERE last_sign_in_at IS NOT NULL;
  SELECT count(*) INTO v_activos30d FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days';

  SELECT count(*) INTO v_gerentes_cuentas
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM public.gerentes g
    WHERE g.user_id = u.id
      AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
  );

  SELECT count(*) INTO v_gerentes_logueados
  FROM auth.users u
  WHERE u.last_sign_in_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.gerentes g
      WHERE g.user_id = u.id
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.mes), '[]'::jsonb) INTO v_por_mes
  FROM (
    SELECT
      to_char(date_trunc('month', rt.created_at), 'YYYY-MM') AS mes,
      count(DISTINCT rt.user_id) AS usuarios_activos,
      count(*) AS eventos
    FROM auth.refresh_tokens rt
    WHERE rt.created_at >= desde
    GROUP BY 1
  ) t;

  -- topUso: sp = total del ledger
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.dias_activos DESC), '[]'::jsonb) INTO v_top_uso
  FROM (
    SELECT
      g.nombre,
      g.pais,
      g.canal,
      count(DISTINCT rt.created_at::date) AS dias_activos,
      max(rt.created_at)::date AS ultima_actividad,
      COALESCE(max(led.total), 0) AS sp
    FROM auth.refresh_tokens rt
    JOIN public.gerentes g ON g.user_id::text = rt.user_id::text
    LEFT JOIN _led_tmp led ON led.gerente_id = g.id
    WHERE rt.created_at >= desde
      AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    GROUP BY g.nombre, g.pais, g.canal
    ORDER BY dias_activos DESC
    LIMIT 10
  ) t;

  -- porCanalPais
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_canal_pais
  FROM (
    SELECT
      g.pais,
      g.canal,
      count(*) AS cuentas,
      count(*) FILTER (WHERE u.last_sign_in_at IS NOT NULL) AS logueados,
      count(*) FILTER (WHERE u.last_sign_in_at >= now() - interval '30 days') AS activos30d
    FROM public.gerentes g
    JOIN auth.users u ON u.id = g.user_id
    WHERE NOT (g.pais = 'MEX' AND g.canal = 'VC')
    GROUP BY g.pais, g.canal
    ORDER BY g.pais, g.canal
  ) t;

  -- retos
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
        WHERE NOT (g.pais = 'MEX' AND g.canal = 'VC')
        GROUP BY g.nombre, g.pais, g.canal
        ORDER BY retos DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_retos;

  -- spCanje desde ledger
  SELECT jsonb_build_object(
    'conSaldo', (
      SELECT count(DISTINCT g.id)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE led.canje > 0
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    ),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT g.nombre, g.pais, g.canal, led.canje AS sp
        FROM public.gerentes g
        JOIN _led_tmp led ON led.gerente_id = g.id
        WHERE led.canje > 0
          AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
        ORDER BY led.canje DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_canje;

  -- spConvencion desde ledger
  SELECT jsonb_build_object(
    'conPuntos', (
      SELECT count(DISTINCT g.id)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE led.conv > 0
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    ),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT g.nombre, g.pais, g.canal, led.conv AS sp
        FROM public.gerentes g
        JOIN _led_tmp led ON led.gerente_id = g.id
        WHERE led.conv > 0
          AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
        ORDER BY led.conv DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_convencion;

  -- resumenSp
  SELECT jsonb_build_object(
    'conSpTotal', (
      SELECT count(DISTINCT g.id)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE led.total > 0
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    ),
    'conCanje', (
      SELECT count(DISTINCT g.id)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE led.canje > 0
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    ),
    'conConvencion', (
      SELECT count(DISTINCT g.id)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE led.conv > 0
        AND NOT (g.pais = 'MEX' AND g.canal = 'VC')
    ),
    'spTotalGlobal', (
      SELECT COALESCE(SUM(led.total),0)
      FROM public.gerentes g
      JOIN _led_tmp led ON led.gerente_id = g.id
      WHERE NOT (g.pais = 'MEX' AND g.canal = 'VC')
    )
  ) INTO v_resumen_sp;

  -- canjes
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.canjes),
    'porEstado', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT estado, count(*) AS n, COALESCE(sum(puntos_gastados),0) AS sp
        FROM public.canjes
        GROUP BY estado
      ) t
    ), '[]'::jsonb)
  ) INTO v_canjes;

  -- directores (sin filtro MEX·VC)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_directores
  FROM (
    SELECT
      d.nombre,
      d.cargo,
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

  DROP TABLE IF EXISTS _led_tmp;

  RETURN jsonb_build_object(
    'cuentas', v_cuentas,
    'logueados', v_logueados,
    'activos30d', v_activos30d,
    'gerentesCuentas', v_gerentes_cuentas,
    'gerentesLogueados', v_gerentes_logueados,
    'porMes', v_por_mes,
    'topUso', v_top_uso,
    'detalle', v_detalle
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gamificacion_uso_stats(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacion_uso_stats(date) TO service_role;

COMMENT ON FUNCTION public.gamificacion_uso_stats(date) IS
'Read-only aggregated gamification usage stats (SECURITY DEFINER, STABLE). Excludes MEX·VC from all gerente aggregates (directores unaffected). SP calculados desde el ledger sp_acumulados (fuente de verdad, canje+convencion); tops y topUso usan el ledger, no columnas denormalizadas.';
