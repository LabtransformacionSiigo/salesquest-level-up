
-- =============================================
-- PASO 1: CHECK CONSTRAINTS
-- =============================================
ALTER TABLE sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0);
ALTER TABLE sales ADD CONSTRAINT sales_xp_non_negative CHECK (xp_earned >= 0);
ALTER TABLE products ADD CONSTRAINT products_xp_positive CHECK (xp_value > 0);
ALTER TABLE levels ADD CONSTRAINT levels_xp_range CHECK (min_xp >= 0 AND max_xp > min_xp);
ALTER TABLE profiles ADD CONSTRAINT profiles_xp_non_negative CHECK (xp >= 0);
ALTER TABLE profiles ADD CONSTRAINT profiles_streak_non_negative CHECK (streak >= 0);
ALTER TABLE profiles ADD CONSTRAINT profiles_shields_non_negative CHECK (shields >= 0);
ALTER TABLE medals ADD CONSTRAINT medals_condition_positive CHECK (condition_value > 0);

-- =============================================
-- PASO 2: INDICES DE RENDIMIENTO
-- =============================================
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cell_id ON profiles(cell_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_user_id ON user_medals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- =============================================
-- PASO 3: CORREGIR FKs SIN ON DELETE
-- =============================================
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_registered_by_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_registered_by_fkey 
  FOREIGN KEY (registered_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sales_uploads DROP CONSTRAINT IF EXISTS sales_uploads_uploaded_by_fkey;
ALTER TABLE sales_uploads ADD CONSTRAINT sales_uploads_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- =============================================
-- PASO 4: CORREGIR ROLES {public} -> {authenticated} EN manager_cells
-- =============================================
DROP POLICY IF EXISTS "Admins can manage manager_cells" ON manager_cells;
CREATE POLICY "Admins can manage manager_cells" ON manager_cells
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'ADMINISTRADOR'));

DROP POLICY IF EXISTS "Managers can view own assignments" ON manager_cells;
CREATE POLICY "Managers can view own assignments" ON manager_cells
  FOR SELECT TO authenticated USING (manager_id = auth.uid());

-- =============================================
-- PASO 5: AGREGAR POLITICAS INSERT PARA SALES (gerentes/admins)
-- =============================================
CREATE POLICY "Managers can insert team sales" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'GERENTE'::app_role) AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = sales.user_id AND manager_id = auth.uid())
  );

CREATE POLICY "Admins can insert any sales" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMINISTRADOR'::app_role));

-- =============================================
-- PASO 3b: TRIGGER PARA CALCULAR XP AUTOMATICAMENTE
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_sale_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT xp_value * NEW.quantity INTO NEW.xp_earned
  FROM products WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_sale_xp
  BEFORE INSERT ON sales FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_xp();
