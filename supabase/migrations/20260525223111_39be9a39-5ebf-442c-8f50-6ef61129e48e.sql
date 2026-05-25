
CREATE OR REPLACE FUNCTION public.recalcular_sp_canje_global()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gerentes_actualizados int := 0;
  v_asesores_actualizados int := 0;
BEGIN
  -- Permitir solo a admin o especialista
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'especialista'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Recalcular gerentes
  WITH ganados AS (
    SELECT gerente_id, SUM(sp)::int AS sp_real
    FROM sp_acumulados
    WHERE tipo_sp = 'canje'
    GROUP BY gerente_id
  ),
  gastados AS (
    SELECT gerente_id, SUM(puntos_gastados)::int AS gastado
    FROM canjes
    WHERE estado <> 'rechazado'
    GROUP BY gerente_id
  ),
  upd AS (
    UPDATE gerentes g
    SET sp_canje = GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
    FROM (SELECT id FROM gerentes) ids
    LEFT JOIN ganados gan ON gan.gerente_id = ids.id
    LEFT JOIN gastados gas ON gas.gerente_id = ids.id
    WHERE g.id = ids.id
      AND g.sp_canje IS DISTINCT FROM GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
    RETURNING g.id
  )
  SELECT count(*) INTO v_gerentes_actualizados FROM upd;

  -- Recalcular asesores
  WITH ganados AS (
    SELECT gerente_id, SUM(sp)::int AS sp_real
    FROM sp_acumulados
    WHERE tipo_sp = 'canje'
    GROUP BY gerente_id
  ),
  gastados AS (
    SELECT gerente_id, SUM(puntos_gastados)::int AS gastado
    FROM canjes
    WHERE estado <> 'rechazado'
    GROUP BY gerente_id
  ),
  upd AS (
    UPDATE asesores a
    SET sp_canje = GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
    FROM (SELECT id FROM asesores) ids
    LEFT JOIN ganados gan ON gan.gerente_id = ids.id
    LEFT JOIN gastados gas ON gas.gerente_id = ids.id
    WHERE a.id = ids.id
      AND a.sp_canje IS DISTINCT FROM GREATEST(COALESCE(gan.sp_real,0) - COALESCE(gas.gastado,0), 0)
    RETURNING a.id
  )
  SELECT count(*) INTO v_asesores_actualizados FROM upd;

  RETURN jsonb_build_object(
    'success', true,
    'gerentes_actualizados', v_gerentes_actualizados,
    'asesores_actualizados', v_asesores_actualizados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_sp_canje_global() TO authenticated;
