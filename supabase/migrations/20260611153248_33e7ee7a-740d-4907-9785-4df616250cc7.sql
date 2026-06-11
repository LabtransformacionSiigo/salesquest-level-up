
-- Mapeo canal -> operacion del especialista
CREATE OR REPLACE FUNCTION public.canal_to_operacion(_canal text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _canal
    WHEN 'VC' THEN 'Venta Cruzada'
    WHEN 'VN_ALIADOS' THEN 'Venta Nueva (Aliados)'
    WHEN 'VN_EMPRESARIOS' THEN 'Venta Nueva (Empresarios)'
    ELSE NULL
  END
$$;

-- Trigger function: notificar canje a especialistas/admins con scope
CREATE OR REPLACE FUNCTION public.notify_canje_especialistas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gerente RECORD;
  v_premio RECORD;
  v_operacion TEXT;
  v_saldo INT;
  v_msg TEXT;
  r RECORD;
BEGIN
  SELECT id, nombre, canal, pais, sp_canje
    INTO v_gerente
  FROM gerentes WHERE id = NEW.gerente_id;

  IF v_gerente.id IS NULL THEN
    SELECT id, nombre, canal, pais, sp_canje INTO v_gerente
    FROM asesores WHERE id = NEW.gerente_id;
  END IF;

  SELECT nombre, pais, operacion INTO v_premio FROM premios WHERE id = NEW.premio_id;
  v_operacion := canal_to_operacion(v_gerente.canal);
  v_saldo := COALESCE(v_gerente.sp_canje, 0);

  v_msg := COALESCE(v_gerente.nombre, 'Un gerente') ||
           ' canjeó "' || COALESCE(v_premio.nombre, 'premio') || '" por ' ||
           NEW.puntos_gastados || ' SP. Saldo restante: ' || v_saldo || ' SP Canje.';

  -- Notificar a cada especialista con scope que cubre pais + operacion del gerente
  FOR r IN
    SELECT g.id AS gerente_id
    FROM especialista_permisos ep
    JOIN gerentes g ON g.user_id = ep.user_id
    WHERE v_gerente.pais = ANY(ep.paises)
      AND (v_operacion IS NULL OR v_operacion = ANY(ep.operaciones))
  LOOP
    INSERT INTO notificaciones (gerente_id, tipo, titulo, mensaje)
    VALUES (r.gerente_id, 'canje', '🎁 Nuevo canje en tu alcance', v_msg);
  END LOOP;

  -- Notificar a todos los admins
  FOR r IN
    SELECT g.id AS gerente_id
    FROM user_roles ur
    JOIN gerentes g ON g.user_id = ur.user_id
    WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO notificaciones (gerente_id, tipo, titulo, mensaje)
    VALUES (r.gerente_id, 'canje', '🎁 Nuevo canje registrado', v_msg);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_canje_especialistas ON public.canjes;
CREATE TRIGGER trg_notify_canje_especialistas
AFTER INSERT ON public.canjes
FOR EACH ROW EXECUTE FUNCTION public.notify_canje_especialistas();
