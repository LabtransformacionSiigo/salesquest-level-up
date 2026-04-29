
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEMP TABLE _ranked ON COMMIT DROP AS
SELECT
  id, nombre, email, celula, user_id, created_at,
  ROW_NUMBER() OVER (
    PARTITION BY lower(unaccent(trim(nombre)))
    ORDER BY
      (CASE WHEN celula IS NOT NULL AND celula <> '' THEN 10 ELSE 0 END
       + CASE WHEN email ~ '^[a-z]+\.[a-z]+@siigo\.com$' THEN 5 ELSE 0 END) DESC,
      created_at ASC
  ) AS rn
FROM gerentes
WHERE activo = true;

CREATE TEMP TABLE _keep   ON COMMIT DROP AS SELECT * FROM _ranked WHERE rn = 1;
CREATE TEMP TABLE _losers ON COMMIT DROP AS SELECT * FROM _ranked WHERE rn > 1;

-- Mapeo perdedor → ganador (para transferencia de user_id al final)
CREATE TEMP TABLE _transfer ON COMMIT DROP AS
SELECT k.id AS keep_id, l.user_id AS new_user_id
FROM _keep k
JOIN _losers l
  ON lower(unaccent(trim(k.nombre))) = lower(unaccent(trim(l.nombre)))
WHERE k.user_id IS NULL
  AND l.user_id IS NOT NULL;

-- 1) Borrar dependencias de los perdedores
DELETE FROM notificaciones    WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM sp_acumulados     WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM medallas          WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM canjes            WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM rachas            WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM retos_completados WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM kpis_mensuales    WHERE gerente_id IN (SELECT id FROM _losers);
DELETE FROM reconocimientos   WHERE de_gerente_id   IN (SELECT id FROM _losers)
                                 OR para_gerente_id IN (SELECT id FROM _losers);
DELETE FROM asesores          WHERE gerente_id IN (SELECT id FROM _losers);

-- 2) Borrar perdedores
DELETE FROM gerentes WHERE id IN (SELECT id FROM _losers);

-- 3) Borrar auth.users de perdedores que no queden referenciados por ningún gerente
DELETE FROM auth.users u
WHERE u.id IN (SELECT user_id FROM _losers WHERE user_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM gerentes g WHERE g.user_id = u.id);

-- 4) Transferir user_id al ganador SOLO si ese user_id sigue existiendo en auth.users
--    (es decir, no fue borrado en el paso 3) y no está ya tomado por otro gerente.
UPDATE gerentes g
SET user_id = t.new_user_id
FROM _transfer t
WHERE g.id = t.keep_id
  AND g.user_id IS NULL
  AND t.new_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.new_user_id)
  AND NOT EXISTS (SELECT 1 FROM gerentes g2 WHERE g2.user_id = t.new_user_id);
