-- Add nickname column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Add active column to medals table
ALTER TABLE medals ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create manager_cells table for many-to-many relationship
CREATE TABLE IF NOT EXISTS manager_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cell_id UUID NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id, cell_id)
);

-- Enable RLS on manager_cells
ALTER TABLE manager_cells ENABLE ROW LEVEL SECURITY;

-- RLS policies for manager_cells
CREATE POLICY "Admins can manage manager_cells"
ON manager_cells
FOR ALL
USING (has_role(auth.uid(), 'ADMINISTRADOR'));

CREATE POLICY "Managers can view own assignments"
ON manager_cells
FOR SELECT
USING (manager_id = auth.uid());

-- Create ranking view for efficient ranking queries
CREATE OR REPLACE VIEW ranking_view AS
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