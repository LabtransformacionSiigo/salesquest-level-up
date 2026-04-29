-- 1) Función de chequeo: devuelve cualquier inconsistencia
CREATE OR REPLACE FUNCTION public.check_gerentes_user_id_integrity()
RETURNS TABLE(
  issue_type text,
  user_id uuid,
  gerente_id uuid,
  nombre text,
  email text,
  canal text,
  celula text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Stubs activos: user_id sin celula
  SELECT
    'stub_sin_celula'::text AS issue_type,
    g.user_id,
    g.id AS gerente_id,
    g.nombre,
    g.email,
    g.canal,
    g.celula
  FROM gerentes g
  WHERE g.activo = true
    AND g.user_id IS NOT NULL
    AND (g.celula IS NULL OR g.celula = '')

  UNION ALL

  -- user_ids con MÁS de un registro con celula asignada (ambigüedad)
  SELECT
    'multiples_con_celula'::text AS issue_type,
    g.user_id,
    g.id AS gerente_id,
    g.nombre,
    g.email,
    g.canal,
    g.celula
  FROM gerentes g
  WHERE g.activo = true
    AND g.user_id IS NOT NULL
    AND g.celula IS NOT NULL AND g.celula <> ''
    AND g.user_id IN (
      SELECT user_id
      FROM gerentes
      WHERE activo = true
        AND user_id IS NOT NULL
        AND celula IS NOT NULL AND celula <> ''
      GROUP BY user_id
      HAVING COUNT(*) > 1
    );
$$;

-- 2) Vista para consulta rápida
CREATE OR REPLACE VIEW public.gerentes_user_id_issues AS
SELECT * FROM public.check_gerentes_user_id_integrity();

-- 3) Trigger preventivo: bloquea cualquier insert/update que cree un stub activo
-- con user_id ya vinculado a un registro con celula
CREATE OR REPLACE FUNCTION public.prevent_gerente_stub_with_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.activo = true
     AND NEW.user_id IS NOT NULL
     AND (NEW.celula IS NULL OR NEW.celula = '')
     AND EXISTS (
       SELECT 1 FROM gerentes g
       WHERE g.user_id = NEW.user_id
         AND g.id <> NEW.id
         AND g.activo = true
         AND g.celula IS NOT NULL AND g.celula <> ''
     )
  THEN
    RAISE EXCEPTION 'No se puede asignar user_id % a un gerente activo sin célula: ya existe un registro con célula para ese usuario', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_gerente_stub_with_user_id ON public.gerentes;
CREATE TRIGGER trg_prevent_gerente_stub_with_user_id
BEFORE INSERT OR UPDATE OF user_id, celula, activo ON public.gerentes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_gerente_stub_with_user_id();