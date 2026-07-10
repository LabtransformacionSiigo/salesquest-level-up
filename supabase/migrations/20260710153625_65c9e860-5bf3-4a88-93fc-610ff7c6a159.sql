
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
  v_detalle jsonb;
BEGIN
  SELECT count(*) INTO v_cuentas FROM auth.users;
  SELECT count(*) INTO v_logueados FROM auth.users WHERE last_sign_in_at IS NOT NULL;
  SELECT count(*) INTO v_activos30d FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days';

  SELECT count(*) INTO v_gerentes_cuentas
  FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.gerentes g WHERE g.user_id = u.id);

  SELECT count(*) INTO v_gerentes_logueados
  FROM auth.users u
  WHERE u.last_sign_in_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.gerentes g WHERE g.user_id = u.id);

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

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.dias_activos DESC), '[]'::jsonb) INTO v_top_uso
  FROM (
    SELECT
      g.nombre,
      g.pais,
      g.canal,
      count(DISTINCT rt.created_at::date) AS dias_activos,
      max(rt.created_at)::date AS ultima_actividad,
      COALESCE(max(rg.sp_totales), 0) AS sp
    FROM auth.refresh_tokens rt
    JOIN public.gerentes g ON g.user_id::text = rt.user_id::text
    LEFT JOIN public.ranking_general rg ON rg.user_id = g.user_id
    WHERE rt.created_at >= desde
    GROUP BY g.nombre, g.pais, g.canal
    ORDER BY dias_activos DESC
    LIMIT 10
  ) t;

  -- 1) porCanalPais
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
    GROUP BY g.pais, g.canal
    ORDER BY g.pais, g.canal
  ) t;

  -- 2) retos
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
        GROUP BY g.nombre, g.pais, g.canal
        ORDER BY retos DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_retos;

  -- 3) spCanje
  SELECT jsonb_build_object(
    'conSaldo', (SELECT count(*) FROM public.gerentes WHERE sp_canje > 0),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT nombre, pais, canal, sp_canje AS sp
        FROM public.gerentes
        WHERE sp_canje > 0
        ORDER BY sp_canje DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_canje;

  -- 4) spConvencion
  SELECT jsonb_build_object(
    'conPuntos', (SELECT count(*) FROM public.gerentes WHERE sp_convencion > 0),
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT nombre, pais, canal, sp_convencion AS sp
        FROM public.gerentes
        WHERE sp_convencion > 0
        ORDER BY sp_convencion DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_sp_convencion;

  -- 5) canjes
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

  -- 6) directores (sin emails)
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
    'canjes', v_canjes,
    'directores', v_directores
  );

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
COMMENT ON FUNCTION public.gamificacion_uso_stats(date) IS 'Read-only aggregated gamification usage stats. Includes extended detalle block (porCanalPais, retos, spCanje, spConvencion, canjes, directores). No emails exposed.';
