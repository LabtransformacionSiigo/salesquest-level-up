-- PASO 1: mover user_id desde stub (sin celula) al registro real (con celula) cuando coincide nombre
UPDATE gerentes real_g
SET user_id = stub.user_id
FROM gerentes stub
WHERE stub.user_id IS NOT NULL
  AND (stub.celula IS NULL OR stub.celula = '')
  AND real_g.celula IS NOT NULL AND real_g.celula != ''
  AND real_g.user_id IS NULL
  AND stub.id != real_g.id
  AND lower(unaccent(trim(stub.nombre))) = lower(unaccent(trim(real_g.nombre)));

-- PASO 2: limpiar user_id del stub si comparte user_id con el real
UPDATE gerentes stub
SET user_id = NULL
FROM gerentes real_g
WHERE stub.user_id = real_g.user_id
  AND stub.id != real_g.id
  AND (stub.celula IS NULL OR stub.celula = '')
  AND real_g.celula IS NOT NULL AND real_g.celula != '';

-- PASO 3: borrar stubs activos sin celula y sin user_id que tienen duplicado real con celula
DELETE FROM gerentes stub
WHERE (stub.celula IS NULL OR stub.celula = '')
  AND stub.user_id IS NULL
  AND stub.activo = true
  AND EXISTS (
    SELECT 1 FROM gerentes real_g
    WHERE real_g.id != stub.id
      AND real_g.celula IS NOT NULL AND real_g.celula != ''
      AND real_g.activo = true
      AND lower(unaccent(trim(real_g.nombre))) = lower(unaccent(trim(stub.nombre)))
  );