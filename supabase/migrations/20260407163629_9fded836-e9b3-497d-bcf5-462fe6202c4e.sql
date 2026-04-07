
CREATE OR REPLACE FUNCTION public.increment_puntos_canjeables(p_gerente_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE gerentes SET puntos_canjeables = puntos_canjeables + p_amount WHERE id = p_gerente_id;
END;
$$;
