CREATE OR REPLACE FUNCTION public.sync_gerente_email_to_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_user_id uuid;
  v_new_email text;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.email,'')) = lower(NEW.email) THEN
    RETURN NEW;
  END IF;

  v_new_email := lower(trim(NEW.email));

  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE lower(email) = v_new_email
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM v_existing_user_id THEN
      -- Liberar el user_id si está asignado a OTRO gerente (evita violar UNIQUE)
      UPDATE public.gerentes
        SET user_id = NULL
        WHERE user_id = v_existing_user_id
          AND id <> NEW.id;

      -- Si el user_id PREVIO de NEW quedará huérfano y pertenece sólo a NEW, lo podemos
      -- borrar de auth.users opcionalmente. Por seguridad NO lo borramos aquí.
      NEW.user_id := v_existing_user_id;
    END IF;
  ELSIF NEW.user_id IS NOT NULL THEN
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
$function$;