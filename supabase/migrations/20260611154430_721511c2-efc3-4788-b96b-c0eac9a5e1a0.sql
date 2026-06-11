CREATE OR REPLACE FUNCTION public.canjear_premio(p_gerente_id uuid, p_premio_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_costo integer;
  v_stock integer;
  v_saldo integer;
  v_canje_id uuid;
  v_is_asesor boolean := false;
  v_owns boolean := false;
BEGIN
  -- Ownership check: caller must own the gerente/asesor record,
  -- OR be admin / especialista (admin override / staff redemption flows)
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM gerentes WHERE id = p_gerente_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM asesores WHERE id = p_gerente_id AND user_id = auth.uid()
  ) INTO v_owns;

  IF NOT v_owns
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'especialista'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT costo_puntos, stock INTO v_costo, v_stock
  FROM premios WHERE id = p_premio_id AND activo = true;

  IF v_costo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premio no encontrado o inactivo');
  END IF;
  IF v_stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premio agotado');
  END IF;

  SELECT sp_canje INTO v_saldo FROM gerentes WHERE id = p_gerente_id;
  IF v_saldo IS NULL THEN
    SELECT sp_canje INTO v_saldo FROM asesores WHERE id = p_gerente_id;
    IF v_saldo IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    v_is_asesor := true;
  END IF;

  IF v_saldo < v_costo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Puntos insuficientes');
  END IF;

  IF v_is_asesor THEN
    UPDATE asesores SET sp_canje = sp_canje - v_costo WHERE id = p_gerente_id;
  ELSE
    UPDATE gerentes SET sp_canje = sp_canje - v_costo WHERE id = p_gerente_id;
  END IF;

  UPDATE premios SET stock = stock - 1 WHERE id = p_premio_id;

  INSERT INTO canjes (gerente_id, premio_id, puntos_gastados)
  VALUES (p_gerente_id, p_premio_id, v_costo)
  RETURNING id INTO v_canje_id;

  RETURN jsonb_build_object('success', true, 'canje_id', v_canje_id);
END;
$function$;