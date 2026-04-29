-- Fix masivo: sincronizar emails de auth.users con gerentes.email
-- y resetear contraseña a SiigoArena2026! para los desincronizados.

DO $$
DECLARE
  v_correctos_antes int;
  v_incorrectos_antes int;
  v_actualizados int;
  v_correctos_despues int;
  v_incorrectos_despues int;
  v_sin_auth int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE u.email = g.email),
    COUNT(*) FILTER (WHERE u.email <> g.email)
  INTO v_correctos_antes, v_incorrectos_antes
  FROM public.gerentes g
  JOIN auth.users u ON u.id = g.user_id
  WHERE g.activo = true AND g.email IS NOT NULL;

  RAISE NOTICE 'ANTES → correctos=%, incorrectos=%', v_correctos_antes, v_incorrectos_antes;

  UPDATE auth.users u
  SET
    email              = g.email,
    email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
    encrypted_password = crypt('SiigoArena2026!', gen_salt('bf')),
    updated_at         = now()
  FROM public.gerentes g
  WHERE u.id = g.user_id
    AND g.activo = true
    AND g.email IS NOT NULL
    AND u.email <> g.email;

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE u.email = g.email),
    COUNT(*) FILTER (WHERE u.email <> g.email)
  INTO v_correctos_despues, v_incorrectos_despues
  FROM public.gerentes g
  JOIN auth.users u ON u.id = g.user_id
  WHERE g.activo = true AND g.email IS NOT NULL;

  SELECT COUNT(*) INTO v_sin_auth
  FROM public.gerentes g
  LEFT JOIN auth.users u ON u.id = g.user_id
  WHERE g.activo = true
    AND g.email IS NOT NULL
    AND (g.user_id IS NULL OR u.id IS NULL);

  RAISE NOTICE 'ACTUALIZADOS=%', v_actualizados;
  RAISE NOTICE 'DESPUÉS → correctos=%, incorrectos=%, sin_auth=%',
    v_correctos_despues, v_incorrectos_despues, v_sin_auth;
END $$;