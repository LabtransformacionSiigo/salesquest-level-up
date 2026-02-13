
-- =============================================
-- FASE 2: NORMALIZACION
-- =============================================

-- PASO 7a: Add level_id FK column
ALTER TABLE profiles ADD COLUMN level_id uuid REFERENCES levels(id) ON DELETE SET NULL;

-- PASO 7b: Migrate existing level data
UPDATE profiles p SET level_id = l.id 
FROM levels l WHERE p.level = l.name;

-- PASO 7c: Drop level text column
ALTER TABLE profiles DROP COLUMN level;

-- PASO 8a: Update ranking_view to use cells.segment instead of profiles.segment
DROP VIEW IF EXISTS ranking_view;
CREATE VIEW ranking_view WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  p.nickname,
  p.avatar,
  p.xp,
  p.cell_id,
  p.country,
  c.segment,
  p.manager_id,
  c.name AS cell_name,
  ur.role,
  rank() OVER (ORDER BY COALESCE(p.xp, 0) DESC) AS global_rank,
  rank() OVER (PARTITION BY p.cell_id ORDER BY COALESCE(p.xp, 0) DESC) AS cell_rank,
  rank() OVER (PARTITION BY p.country ORDER BY COALESCE(p.xp, 0) DESC) AS country_rank,
  rank() OVER (PARTITION BY c.segment ORDER BY COALESCE(p.xp, 0) DESC) AS segment_rank
FROM profiles p
LEFT JOIN cells c ON p.cell_id = c.id
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'EJECUTIVO'::app_role;

-- PASO 8b: Drop segment column from profiles  
ALTER TABLE profiles DROP COLUMN segment;
