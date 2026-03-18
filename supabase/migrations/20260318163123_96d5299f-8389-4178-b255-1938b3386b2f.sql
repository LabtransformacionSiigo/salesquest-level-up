
-- Update handle_new_user to ensure token fields are never NULL for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure critical auth fields are not NULL
  IF NEW.phone IS NULL THEN
    NEW.phone := '';
  END IF;
  IF NEW.email_change IS NULL THEN
    NEW.email_change := '';
  END IF;
  IF NEW.confirmation_token IS NULL THEN
    NEW.confirmation_token := '';
  END IF;
  IF NEW.recovery_token IS NULL THEN
    NEW.recovery_token := '';
  END IF;
  IF NEW.email_change_token_new IS NULL THEN
    NEW.email_change_token_new := '';
  END IF;
  IF NEW.email_change_token_current IS NULL THEN
    NEW.email_change_token_current := '';
  END IF;
  IF NEW.reauthentication_token IS NULL THEN
    NEW.reauthentication_token := '';
  END IF;
  IF NEW.phone_change IS NULL THEN
    NEW.phone_change := '';
  END IF;
  IF NEW.phone_change_token IS NULL THEN
    NEW.phone_change_token := '';
  END IF;

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
