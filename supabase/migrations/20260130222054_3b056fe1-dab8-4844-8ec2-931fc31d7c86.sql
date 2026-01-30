-- Recreate ranking view with SECURITY INVOKER (default, explicit for clarity)
DROP VIEW IF EXISTS ranking_view;

CREATE VIEW ranking_view 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  p.nickname,
  p.avatar,
  p.xp,
  p.cell_id,
  p.country,
  p.segment,
  p.manager_id,
  c.name as cell_name,
  ur.role,
  RANK() OVER (ORDER BY COALESCE(p.xp, 0) DESC) as global_rank,
  RANK() OVER (PARTITION BY p.cell_id ORDER BY COALESCE(p.xp, 0) DESC) as cell_rank,
  RANK() OVER (PARTITION BY p.country ORDER BY COALESCE(p.xp, 0) DESC) as country_rank,
  RANK() OVER (PARTITION BY p.segment ORDER BY COALESCE(p.xp, 0) DESC) as segment_rank
FROM profiles p
LEFT JOIN cells c ON p.cell_id = c.id
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'EJECUTIVO';