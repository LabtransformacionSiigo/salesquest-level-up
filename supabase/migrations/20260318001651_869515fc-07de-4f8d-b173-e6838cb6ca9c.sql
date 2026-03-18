ALTER TABLE public.reconocimientos ADD COLUMN para_nombre text;

DROP VIEW IF EXISTS public.feed_reconocimientos;

CREATE VIEW public.feed_reconocimientos AS
SELECT 
  r.id,
  r.created_at,
  gd.nombre AS de_nombre,
  COALESCE(gp.nombre, r.para_nombre) AS para_nombre,
  gd.avatar_url AS de_avatar,
  gp.avatar_url AS para_avatar,
  r.tipo,
  r.sp_para,
  r.sp_de,
  r.mensaje
FROM reconocimientos r
LEFT JOIN gerentes gd ON gd.id = r.de_gerente_id
LEFT JOIN gerentes gp ON gp.id = r.para_gerente_id
ORDER BY r.created_at DESC;