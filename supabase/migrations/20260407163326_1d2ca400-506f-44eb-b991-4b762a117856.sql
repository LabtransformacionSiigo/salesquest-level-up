
-- 1. Add puntos_canjeables to gerentes and asesores
ALTER TABLE public.gerentes ADD COLUMN puntos_canjeables integer NOT NULL DEFAULT 0;
ALTER TABLE public.asesores ADD COLUMN puntos_canjeables integer NOT NULL DEFAULT 0;

-- 2. Create premios table
CREATE TABLE public.premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  costo_puntos integer NOT NULL,
  imagen_url text,
  stock integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view premios"
  ON public.premios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage premios"
  ON public.premios FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create canjes table
CREATE TABLE public.canjes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  premio_id uuid NOT NULL REFERENCES public.premios(id) ON DELETE CASCADE,
  puntos_gastados integer NOT NULL,
  fecha_canje timestamp with time zone NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'pendiente'
);

ALTER TABLE public.canjes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canjes"
  ON public.canjes FOR SELECT
  TO authenticated
  USING (
    gerente_id IN (SELECT g.id FROM gerentes g WHERE g.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert own canjes"
  ON public.canjes FOR INSERT
  TO authenticated
  WITH CHECK (
    gerente_id IN (SELECT g.id FROM gerentes g WHERE g.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage canjes"
  ON public.canjes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create canjear_premio function
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

  -- Get user balance
  SELECT puntos_canjeables INTO v_saldo FROM gerentes WHERE id = p_gerente_id;

  IF v_saldo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_saldo < v_costo THEN
    RETURN jsonb_build_object('success', false, 'error', 'Puntos insuficientes');
  END IF;

  -- Deduct points
  UPDATE gerentes SET puntos_canjeables = puntos_canjeables - v_costo WHERE id = p_gerente_id;

  -- Deduct stock
  UPDATE premios SET stock = stock - 1 WHERE id = p_premio_id;

  -- Insert canje
  INSERT INTO canjes (gerente_id, premio_id, puntos_gastados)
  VALUES (p_gerente_id, p_premio_id, v_costo)
  RETURNING id INTO v_canje_id;

  RETURN jsonb_build_object('success', true, 'canje_id', v_canje_id);
END;
$$;

-- 5. Update otorgar_medalla_si_aplica to also credit puntos_canjeables
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

    -- Credit redeemable points
    UPDATE gerentes SET puntos_canjeables = puntos_canjeables + p_sp WHERE id = p_gerente_id;

    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- 6. Backfill puntos_canjeables from historical sp_acumulados
UPDATE gerentes g
SET puntos_canjeables = COALESCE((
  SELECT SUM(sp) FROM sp_acumulados sa
  WHERE sa.gerente_id = g.id
    AND sa.fuente IN ('MEDALLA', 'RETO', 'RECONOCIMIENTO', 'RACHA')
), 0);
