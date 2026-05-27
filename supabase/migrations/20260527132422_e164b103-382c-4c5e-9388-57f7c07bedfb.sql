
-- 1) Trigger to prevent self-escalation of SP fields on gerentes
CREATE OR REPLACE FUNCTION public.prevent_self_sp_escalation_gerentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admin or especialista to change anything
  IF auth.uid() IS NOT NULL
     AND (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'especialista'::app_role)) THEN
    RETURN NEW;
  END IF;

  -- Service role / definer functions: auth.uid() will be null when called via service key
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- For everyone else, lock SP fields to their previous values
  IF NEW.sp_canje IS DISTINCT FROM OLD.sp_canje THEN
    NEW.sp_canje := OLD.sp_canje;
  END IF;
  IF NEW.sp_convencion IS DISTINCT FROM OLD.sp_convencion THEN
    NEW.sp_convencion := OLD.sp_convencion;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_sp_escalation_gerentes ON public.gerentes;
CREATE TRIGGER trg_prevent_self_sp_escalation_gerentes
BEFORE UPDATE ON public.gerentes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_sp_escalation_gerentes();

-- 2) Same protection for asesores
CREATE OR REPLACE FUNCTION public.prevent_self_sp_escalation_asesores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'especialista'::app_role)) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sp_canje IS DISTINCT FROM OLD.sp_canje THEN
    NEW.sp_canje := OLD.sp_canje;
  END IF;
  IF NEW.sp_convencion IS DISTINCT FROM OLD.sp_convencion THEN
    NEW.sp_convencion := OLD.sp_convencion;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_sp_escalation_asesores ON public.asesores;
CREATE TRIGGER trg_prevent_self_sp_escalation_asesores
BEFORE UPDATE ON public.asesores
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_sp_escalation_asesores();

-- 3) Realtime channel authorization: require auth + restrict broadcast/presence subscriptions
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
