CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email   text := LOWER(TRIM(COALESCE(NEW.email, '')));
  v_rol     app_role;
  v_hay_ger boolean;
  v_hay_ase boolean;
  v_hay_dir boolean;
  v_hay_esp boolean;
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Enlazar por correo (case-insensitive). El acceso lo concede Entra ID;
  -- aqui solo reconectamos a la persona con sus registros existentes.
  UPDATE gerentes   SET user_id = NEW.id WHERE LOWER(TRIM(email)) = v_email;
  UPDATE asesores   SET user_id = NEW.id WHERE LOWER(TRIM(email)) = v_email;
  UPDATE directores SET user_id = NEW.id WHERE LOWER(TRIM(email)) = v_email;

  SELECT EXISTS(SELECT 1 FROM gerentes   WHERE LOWER(TRIM(email)) = v_email) INTO v_hay_ger;
  SELECT EXISTS(SELECT 1 FROM asesores   WHERE LOWER(TRIM(email)) = v_email) INTO v_hay_ase;
  SELECT EXISTS(SELECT 1 FROM directores WHERE LOWER(TRIM(email)) = v_email) INTO v_hay_dir;
  SELECT EXISTS(SELECT 1 FROM especialista_permisos WHERE user_id = NEW.id)  INTO v_hay_esp;

  -- Derivar el rol. NO se crea ningun registro de dominio: si la persona no
  -- existe en ninguna tabla, entra sin rol y la app le niega el acceso.
  v_rol := CASE
    WHEN v_hay_dir THEN 'director'::app_role
    WHEN v_hay_esp THEN 'especialista'::app_role
    WHEN v_hay_ase THEN 'asesor'::app_role
    WHEN v_hay_ger THEN 'gerente'::app_role
    ELSE NULL
  END;

  IF v_rol IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, v_rol)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;