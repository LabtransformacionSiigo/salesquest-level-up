-- Borrar duplicado huérfano de juan.chavez (sin user_id válido en auth)
DELETE FROM especialista_permisos
WHERE email = 'juan.chavez@siigo.com'
  AND user_id NOT IN (SELECT id FROM auth.users);

-- Asignar rol especialista a juan.chavez y wilmer si no lo tienen
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'especialista'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('juan.chavez@siigo.com', 'wilmer.hernandez@siigo.com')
ON CONFLICT DO NOTHING;