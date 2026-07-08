
CREATE OR REPLACE FUNCTION public.gamificacion_uso_stats(desde date DEFAULT '2026-04-01')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cuentas int;
  v_logueados int;
  v_activos30d int;
  v_gerentes_cuentas int;
  v_gerentes_logueados int;
  v_por_mes jsonb;
  v_top_uso jsonb;
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

  RETURN jsonb_build_object(
    'cuentas', v_cuentas,
    'logueados', v_logueados,
    'activos30d', v_activos30d,
    'gerentesCuentas', v_gerentes_cuentas,
    'gerentesLogueados', v_gerentes_logueados,
    'porMes', v_por_mes,
    'topUso', v_top_uso
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gamificacion_uso_stats(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gamificacion_uso_stats(date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gamificacion_uso_stats(date) TO service_role;

COMMENT ON FUNCTION public.gamificacion_uso_stats(date) IS
  'Solo lectura. Retorna métricas de uso/adopción (auth.users, auth.refresh_tokens) para el dashboard externo vía la edge function gamificacion-agregada. Ejecutable solo por service_role.';
