
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If a gerente with this email already exists, link them
  IF EXISTS (SELECT 1 FROM gerentes WHERE email = NEW.email) THEN
    UPDATE gerentes SET user_id = NEW.id WHERE email = NEW.email;
  ELSE
    INSERT INTO gerentes (user_id, email, nombre, avatar_url, canal, pais)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NULL,
      'VC',
      'MEX'
    );
  END IF;
  RETURN NEW;
END;
$function$;
