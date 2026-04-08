
-- 1. Rename columns on asesores
ALTER TABLE public.asesores RENAME COLUMN puntos_ranking TO sp_convencion;
ALTER TABLE public.asesores RENAME COLUMN puntos_canjeables TO sp_canje;

-- 2. Rename column on gerentes + add sp_convencion
ALTER TABLE public.gerentes RENAME COLUMN puntos_canjeables TO sp_canje;
ALTER TABLE public.gerentes ADD COLUMN sp_convencion integer NOT NULL DEFAULT 0;

-- 3. Add tipo_sp to sp_acumulados to distinguish convention vs canje points
ALTER TABLE public.sp_acumulados ADD COLUMN tipo_sp text NOT NULL DEFAULT 'convencion';

-- Mark existing MEDALLA/RETO/RECONOCIMIENTO entries as 'canje'
UPDATE public.sp_acumulados SET tipo_sp = 'canje' WHERE fuente IN ('MEDALLA', 'RETO', 'RECONOCIMIENTO');

-- 4. Update canjear_premio to use sp_canje
CREATE OR REPLACE FUNCTION public.canjear_premio(p_gerente_id uuid, p_premio_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_costo integer;
  v_stock integer;
  v_saldo integer;
  v_canje_id uuid;
  v_is_asesor boolean := false;
BEGIN
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
$$;

-- 5. Rename and update increment function
CREATE OR REPLACE FUNCTION public.increment_sp_canje(p_gerente_id uuid, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE gerentes SET sp_canje = sp_canje + p_amount WHERE id = p_gerente_id;
  IF NOT FOUND THEN
    UPDATE asesores SET sp_canje = sp_canje + p_amount WHERE id = p_gerente_id;
  END IF;
END;
$$;

-- Keep old function as alias for backward compat
CREATE OR REPLACE FUNCTION public.increment_puntos_canjeables(p_gerente_id uuid, p_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  PERFORM increment_sp_canje(p_gerente_id, p_amount);
END;
$$;

-- 6. Update otorgar_medalla_si_aplica to credit sp_canje
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

    INSERT INTO sp_acumulados (gerente_id, fuente, sp, periodo, detalle, tipo_sp)
    VALUES (p_gerente_id, 'MEDALLA', p_sp,
            TO_CHAR(CURRENT_DATE,'YYYY-MM'), p_medalla, 'canje');

    UPDATE gerentes SET sp_canje = sp_canje + p_sp WHERE id = p_gerente_id;
    IF NOT FOUND THEN
      UPDATE asesores SET sp_canje = sp_canje + p_sp WHERE id = p_gerente_id;
    END IF;

    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- 7. Drop and recreate views that reference renamed columns

-- sp_totales_gerente view
DROP VIEW IF EXISTS public.sp_totales_gerente;
CREATE OR REPLACE VIEW public.sp_totales_gerente AS
SELECT
  g.id,
  g.user_id,
  g.nombre,
  g.canal,
  g.pais,
  g.avatar_url,
  g.activo,
  g.lider,
  COALESCE(s.sp_totales, 0) AS sp_totales,
  g.sp_convencion,
  CASE
    WHEN COALESCE(s.sp_totales, 0) >= 6001 THEN 'Diamante'
    WHEN COALESCE(s.sp_totales, 0) >= 4501 THEN 'Esmeralda'
    WHEN COALESCE(s.sp_totales, 0) >= 3001 THEN 'Zafiro'
    WHEN COALESCE(s.sp_totales, 0) >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END AS nivel,
  CASE
    WHEN COALESCE(s.sp_totales, 0) >= 6001 THEN COALESCE(s.sp_totales, 0) - 6001
    WHEN COALESCE(s.sp_totales, 0) >= 4501 THEN COALESCE(s.sp_totales, 0) - 4501
    WHEN COALESCE(s.sp_totales, 0) >= 3001 THEN COALESCE(s.sp_totales, 0) - 3001
    WHEN COALESCE(s.sp_totales, 0) >= 1501 THEN COALESCE(s.sp_totales, 0) - 1501
    ELSE COALESCE(s.sp_totales, 0)
  END AS sp_nivel_actual,
  CASE
    WHEN COALESCE(s.sp_totales, 0) >= 6001 THEN 1500
    WHEN COALESCE(s.sp_totales, 0) >= 4501 THEN 1500
    WHEN COALESCE(s.sp_totales, 0) >= 3001 THEN 1500
    WHEN COALESCE(s.sp_totales, 0) >= 1501 THEN 1500
    ELSE 1500
  END AS sp_siguiente_nivel
FROM gerentes g
LEFT JOIN (
  SELECT gerente_id, SUM(sp) AS sp_totales
  FROM sp_acumulados
  WHERE tipo_sp = 'convencion'
  GROUP BY gerente_id
) s ON g.id = s.gerente_id;

-- ranking_general view
DROP VIEW IF EXISTS public.ranking_general;
CREATE OR REPLACE VIEW public.ranking_general AS
SELECT
  g.id,
  g.user_id,
  g.nombre,
  g.canal,
  g.pais,
  g.avatar_url,
  COALESCE(s.sp_totales, 0) AS sp_totales,
  CASE
    WHEN COALESCE(s.sp_totales, 0) >= 6001 THEN 'Diamante'
    WHEN COALESCE(s.sp_totales, 0) >= 4501 THEN 'Esmeralda'
    WHEN COALESCE(s.sp_totales, 0) >= 3001 THEN 'Zafiro'
    WHEN COALESCE(s.sp_totales, 0) >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END AS nivel,
  ROW_NUMBER() OVER (ORDER BY COALESCE(s.sp_totales, 0) DESC) AS posicion,
  ROW_NUMBER() OVER (PARTITION BY g.canal ORDER BY COALESCE(s.sp_totales, 0) DESC) AS posicion_canal
FROM gerentes g
LEFT JOIN (
  SELECT gerente_id, SUM(sp) AS sp_totales
  FROM sp_acumulados
  WHERE tipo_sp = 'convencion'
  GROUP BY gerente_id
) s ON g.id = s.gerente_id
WHERE g.activo = true;
