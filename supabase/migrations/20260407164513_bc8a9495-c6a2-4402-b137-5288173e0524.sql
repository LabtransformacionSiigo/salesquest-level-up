
-- Update increment_puntos_canjeables to support both gerentes and asesores
CREATE OR REPLACE FUNCTION public.increment_puntos_canjeables(p_gerente_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try gerentes first
  UPDATE gerentes SET puntos_canjeables = puntos_canjeables + p_amount WHERE id = p_gerente_id;
  IF NOT FOUND THEN
    -- Try asesores
    UPDATE asesores SET puntos_canjeables = puntos_canjeables + p_amount WHERE id = p_gerente_id;
  END IF;
END;
$$;

-- Update canjear_premio to support both gerentes and asesores
CREATE OR REPLACE FUNCTION public.canjear_premio(p_gerente_id uuid, p_premio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo integer;
  v_stock integer;
  v_saldo integer;
  v_canje_id uuid;
  v_is_asesor boolean := false;
BEGIN
  -- Get premio info
  SELECT costo_puntos, stock INTO v_costo, v_stock
  FROM premios WHERE id = p_premio_id AND activo = true;

  IF v_costo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premio no encontrado o inactivo');
  END IF;

  IF v_stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Premio agotado');
  END IF;

  -- Try gerentes first
  SELECT puntos_canjeables INTO v_saldo FROM gerentes WHERE id = p_gerente_id;

  IF v_saldo IS NULL THEN
    -- Try asesores
    SELECT puntos_canjeables INTO v_saldo FROM asesores WHERE id = p_gerente_id;
    IF v_saldo IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    v_is_asesor := true;
  END IF;

  IF v_saldo < v_costo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Puntos insuficientes');
  END IF;

  -- Deduct points
  IF v_is_asesor THEN
    UPDATE asesores SET puntos_canjeables = puntos_canjeables - v_costo WHERE id = p_gerente_id;
  ELSE
    UPDATE gerentes SET puntos_canjeables = puntos_canjeables - v_costo WHERE id = p_gerente_id;
  END IF;

  -- Deduct stock
  UPDATE premios SET stock = stock - 1 WHERE id = p_premio_id;

  -- Insert canje (gerente_id column used for both roles)
  INSERT INTO canjes (gerente_id, premio_id, puntos_gastados)
  VALUES (p_gerente_id, p_premio_id, v_costo)
  RETURNING id INTO v_canje_id;

  RETURN jsonb_build_object('success', true, 'canje_id', v_canje_id);
END;
$$;

-- Also update otorgar_medalla_si_aplica to handle both tables
CREATE OR REPLACE FUNCTION public.otorgar_medalla_si_aplica(p_gerente_id uuid, p_medalla text, p_sp integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  ya_tiene BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM medallas
    WHERE gerente_id = p_gerente_id AND medalla = p_medalla
  ) INTO ya_tiene;

  IF NOT ya_tiene THEN
    INSERT INTO medallas (gerente_id, medalla, sp_otorgados)
    VALUES (p_gerente_id, p_medalla, p_sp);

    INSERT INTO sp_acumulados (gerente_id, fuente, sp, periodo, detalle)
    VALUES (p_gerente_id, 'MEDALLA', p_sp,
            TO_CHAR(CURRENT_DATE,'YYYY-MM'), p_medalla);

    -- Credit redeemable points to gerentes or asesores
    UPDATE gerentes SET puntos_canjeables = puntos_canjeables + p_sp WHERE id = p_gerente_id;
    IF NOT FOUND THEN
      UPDATE asesores SET puntos_canjeables = puntos_canjeables + p_sp WHERE id = p_gerente_id;
    END IF;

    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;
