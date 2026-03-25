
-- Notifications table
CREATE TABLE public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'nivel_up', 'medalla'
  titulo TEXT NOT NULL,
  mensaje TEXT,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notificaciones FOR SELECT TO authenticated
USING (gerente_id IN (SELECT id FROM gerentes WHERE user_id = auth.uid()));

CREATE POLICY "System can insert notifications"
ON public.notificaciones FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON public.notificaciones FOR UPDATE TO authenticated
USING (gerente_id IN (SELECT id FROM gerentes WHERE user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;

-- Trigger: auto-notify on medal unlock
CREATE OR REPLACE FUNCTION public.notify_medalla_desbloqueada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  SELECT nombre INTO v_nombre FROM gerentes WHERE id = NEW.gerente_id;
  INSERT INTO notificaciones (gerente_id, tipo, titulo, mensaje)
  VALUES (
    NEW.gerente_id,
    'medalla',
    '🏅 ¡Nueva medalla desbloqueada!',
    'Has desbloqueado la medalla "' || NEW.medalla || '" y ganaste ' || COALESCE(NEW.sp_otorgados, 0) || ' SP.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_medalla_notificacion
AFTER INSERT ON public.medallas
FOR EACH ROW EXECUTE FUNCTION public.notify_medalla_desbloqueada();

-- Trigger: auto-notify on level change (via sp_acumulados insert/update)
CREATE OR REPLACE FUNCTION public.notify_nivel_cambio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sp_total INTEGER;
  v_nivel_anterior TEXT;
  v_nivel_nuevo TEXT;
BEGIN
  -- Calculate new total SP
  SELECT COALESCE(SUM(sp), 0) INTO v_sp_total
  FROM sp_acumulados WHERE gerente_id = NEW.gerente_id;

  -- Determine new level
  v_nivel_nuevo := CASE
    WHEN v_sp_total >= 6001 THEN 'Diamante'
    WHEN v_sp_total >= 4501 THEN 'Esmeralda'
    WHEN v_sp_total >= 3001 THEN 'Zafiro'
    WHEN v_sp_total >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END;

  -- Calculate previous level (before this SP was added)
  v_nivel_anterior := CASE
    WHEN (v_sp_total - NEW.sp) >= 6001 THEN 'Diamante'
    WHEN (v_sp_total - NEW.sp) >= 4501 THEN 'Esmeralda'
    WHEN (v_sp_total - NEW.sp) >= 3001 THEN 'Zafiro'
    WHEN (v_sp_total - NEW.sp) >= 1501 THEN 'Rubí'
    ELSE 'Cuarzo'
  END;

  -- Only notify if level changed
  IF v_nivel_nuevo <> v_nivel_anterior THEN
    INSERT INTO notificaciones (gerente_id, tipo, titulo, mensaje)
    VALUES (
      NEW.gerente_id,
      'nivel_up',
      '🚀 ¡Subiste de nivel!',
      'Has alcanzado el nivel ' || v_nivel_nuevo || '. ¡Sigue así!'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nivel_notificacion
AFTER INSERT ON public.sp_acumulados
FOR EACH ROW EXECUTE FUNCTION public.notify_nivel_cambio();
