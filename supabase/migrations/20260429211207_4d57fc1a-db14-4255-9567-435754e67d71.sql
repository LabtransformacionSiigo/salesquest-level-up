-- 1) Función que sincroniza gerentes.email -> auth.users.email
CREATE OR REPLACE FUNCTION public.sync_gerente_email_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_user_id uuid;
  v_new_email text;
BEGIN
  -- Solo si el email cambió
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.email,'')) = lower(NEW.email) THEN
    RETURN NEW;
  END IF;

  v_new_email := lower(trim(NEW.email));

  -- ¿Ya existe un auth.users con el nuevo email?
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE lower(email) = v_new_email
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    -- Re-vincular: el auth.users con el nuevo email es el dueño
    IF NEW.user_id IS DISTINCT FROM v_existing_user_id THEN
      NEW.user_id := v_existing_user_id;
    END IF;
  ELSIF NEW.user_id IS NOT NULL THEN
    -- Actualizar el email en auth.users existente
    BEGIN
      UPDATE auth.users
      SET email = v_new_email,
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_new_email),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo actualizar auth.users.email para user_id=%: %', NEW.user_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger BEFORE UPDATE en gerentes
DROP TRIGGER IF EXISTS trg_sync_gerente_email_to_auth ON public.gerentes;
CREATE TRIGGER trg_sync_gerente_email_to_auth
BEFORE UPDATE OF email ON public.gerentes
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_gerente_email_to_auth();

-- 3) Reparar desajustes existentes
DO $$
DECLARE
  r RECORD;
  v_existing_user_id uuid;
BEGIN
  FOR r IN
    SELECT g.id AS gerente_id, g.user_id, lower(trim(g.email)) AS new_email, u.email AS old_auth_email
    FROM public.gerentes g
    JOIN auth.users u ON u.id = g.user_id
    WHERE g.activo = true
      AND lower(g.email) <> lower(u.email)
  LOOP
    -- ¿Existe ya otro auth.users con el nuevo email?
    SELECT id INTO v_existing_user_id
    FROM auth.users
    WHERE lower(email) = r.new_email
      AND id <> r.user_id
    LIMIT 1;

    IF v_existing_user_id IS NOT NULL THEN
      -- Re-vincular gerente al usuario existente
      UPDATE public.gerentes SET user_id = v_existing_user_id WHERE id = r.gerente_id;
      RAISE NOTICE 'Gerente % re-vinculado a auth.users %', r.gerente_id, v_existing_user_id;
    ELSE
      -- Actualizar email en auth.users
      UPDATE auth.users
      SET email = r.new_email,
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', r.new_email),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = r.user_id;
      RAISE NOTICE 'auth.users % email % -> %', r.user_id, r.old_auth_email, r.new_email;
    END IF;
  END LOOP;
END $$;