UPDATE public.gerentes SET nombre = initcap(replace(nombre, '.', ' '))
WHERE activo = true AND nombre ~ '^[a-z]+\.[a-z]+';