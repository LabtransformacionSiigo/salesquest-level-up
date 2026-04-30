-- 1) Mapear emails a su user_id real en auth.users (lookup por email primario)
WITH real_users AS (
  SELECT lower(u.email) AS email, u.id AS auth_user_id
  FROM auth.users u
  WHERE lower(u.email) IN (
    'angela.hernandez@siigo.com',
    'dayanna.pinilla@siigo.com',
    'juan.arce@siigo.com',
    'said.gomez@siigo.com'
  )
),
-- 2) Para cada email, conservar UN solo registro de especialista_permisos (el más reciente)
keepers AS (
  SELECT DISTINCT ON (lower(ep.email)) ep.id AS keep_id, lower(ep.email) AS email
  FROM especialista_permisos ep
  WHERE lower(ep.email) IN (SELECT email FROM real_users)
  ORDER BY lower(ep.email), ep.created_at DESC
)
-- 3) Borrar duplicados
DELETE FROM especialista_permisos ep
WHERE lower(ep.email) IN (SELECT email FROM real_users)
  AND ep.id NOT IN (SELECT keep_id FROM keepers);

-- 4) Reapuntar user_id al auth real
UPDATE especialista_permisos ep
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(ep.email)
  AND lower(ep.email) IN (
    'angela.hernandez@siigo.com',
    'dayanna.pinilla@siigo.com',
    'juan.arce@siigo.com',
    'said.gomez@siigo.com'
  );

-- 5) Asignar rol 'especialista' a los user_id reales (idempotente)
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'especialista'::app_role
FROM auth.users u
WHERE lower(u.email) IN (
    'angela.hernandez@siigo.com',
    'dayanna.pinilla@siigo.com',
    'juan.arce@siigo.com',
    'said.gomez@siigo.com'
  )
ON CONFLICT DO NOTHING;