
# Auditoria Arquitectonica y Plan de Migracion

## Resumen del Analisis

He revisado exhaustivamente el esquema actual contra los 4 principios solicitados. A continuacion presento los hallazgos y las correcciones necesarias.

---

## 1. Normalizacion y Estructura (3NF)

### Hallazgos Positivos
- Roles correctamente separados en `user_roles` (no en `profiles`) - excelente
- Relacion M:N entre managers y cells via `manager_cells` - correcto
- `user_medals` como tabla puente entre `profiles` y `medals` - correcto

### Problemas Detectados

| Problema | Tabla | Detalle |
|----------|-------|---------|
| **`level` como texto en `profiles`** | `profiles` | Almacena el nombre del nivel como texto plano (`'Novato'`). Deberia ser una FK a `levels.id` para evitar inconsistencias |
| **`segment` duplicado** | `profiles` | El segmento del ejecutivo ya esta determinado por su `cell_id` -> `cells.segment`. Tenerlo tambien en `profiles` viola 3NF (dato derivable) |
| **`category` y `condition_type` como texto** | `medals` | Deberian ser enums para evitar valores invalidos |
| **`country` como texto libre** | `profiles`, `cells` | Sin validacion; podria ser un enum o tabla de referencia |

### Correcciones Propuestas

**a) Convertir `profiles.level` a FK:**
```sql
-- Agregar columna level_id referenciando levels
ALTER TABLE profiles ADD COLUMN level_id uuid REFERENCES levels(id) ON DELETE SET NULL;

-- Migrar datos existentes
UPDATE profiles p SET level_id = l.id 
FROM levels l WHERE p.level = l.name;

-- Eliminar la columna texto (despues de actualizar el codigo)
ALTER TABLE profiles DROP COLUMN level;
```

**b) Eliminar `profiles.segment` (derivable de cell):**
- Se obtiene via `profiles.cell_id -> cells.segment`
- Requiere actualizar el codigo que lea `segment` para hacer JOIN con `cells`
- Nota: ejecutivos sin celda perderian segmento. Se puede mantener como campo opcional para esos casos, o asignar siempre una celda

**c) Crear enums para medals:**
```sql
CREATE TYPE medal_category AS ENUM ('efectividad', 'volumen', 'colaboracion', 'valor');
CREATE TYPE medal_condition AS ENUM ('total_xp', 'total_sales', 'streak_days', 'products_sold', ...);
ALTER TABLE medals ALTER COLUMN category TYPE medal_category USING category::medal_category;
ALTER TABLE medals ALTER COLUMN condition_type TYPE medal_condition USING condition_type::medal_condition;
```

---

## 2. Seguridad (RLS)

### Hallazgos Positivos
- RLS habilitado en todas las tablas
- Funcion `has_role()` como SECURITY DEFINER para evitar recursion - excelente
- Separacion correcta de permisos por rol

### Problemas Detectados

| Problema | Tabla | Riesgo |
|----------|-------|--------|
| **`manager_cells` usa roles `{public}`** | `manager_cells` | Las politicas aplican al rol `public` (anon), no `authenticated`. Un usuario no autenticado podria intentar acceder |
| **`sales` INSERT solo permite `user_id = auth.uid()`** | `sales` | Los gerentes/admins registran ventas para otros (via edge function con service key), pero la politica RLS para INSERT no lo permite directamente. Funciona porque la edge function usa service key, pero es una dependencia fragil |
| **`sales_uploads` sin politica DELETE/UPDATE** | `sales_uploads` | Correcto como decision de negocio (inmutabilidad), pero deberia documentarse |
| **`ranking_view` sin RLS** | `ranking_view` | Es una vista con `security_invoker=true`, lo cual es correcto - las politicas de `profiles` aplican |
| **Edge Functions con `verify_jwt = false`** | `config.toml` | `process-sales-upload` y `evaluate-medals` no verifican JWT a nivel gateway. Aunque validan internamente, esto permite llamadas sin token al endpoint |

### Correcciones Propuestas

**a) Corregir roles en `manager_cells`:**
```sql
-- Cambiar politicas de {public} a {authenticated}
DROP POLICY "Admins can manage manager_cells" ON manager_cells;
CREATE POLICY "Admins can manage manager_cells" ON manager_cells
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'ADMINISTRADOR'));

DROP POLICY "Managers can view own assignments" ON manager_cells;
CREATE POLICY "Managers can view own assignments" ON manager_cells
  FOR SELECT TO authenticated USING (manager_id = auth.uid());
```

**b) Agregar politica INSERT para sales (gerentes/admins):**
```sql
CREATE POLICY "Managers can insert team sales" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'GERENTE') AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = sales.user_id AND manager_id = auth.uid())
  );

CREATE POLICY "Admins can insert any sales" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMINISTRADOR'));
```

**c) Habilitar JWT en Edge Functions:**
```toml
[functions.process-sales-upload]
verify_jwt = true

[functions.evaluate-medals]
verify_jwt = true
```

---

## 3. Integridad y Logica de Negocio

### Problemas Detectados

| Problema | Tabla | Detalle |
|----------|-------|---------|
| **Sin CHECK en `sales.quantity`** | `sales` | Permite valores 0 o negativos |
| **Sin CHECK en `sales.xp_earned`** | `sales` | Permite XP negativo |
| **Sin CHECK en `products.xp_value`** | `products` | Permite valores negativos |
| **Sin CHECK en `levels.min_xp/max_xp`** | `levels` | No valida que `min_xp < max_xp` ni que sean >= 0 |
| **Sin CHECK en `profiles.xp`** | `profiles` | Permite XP negativo |
| **`sales.registered_by` es nullable** | `sales` | Toda venta deberia tener un registrador |
| **`sales_uploads.uploaded_by` sin ON DELETE** | `sales_uploads` | FK sin accion referencial definida |
| **`sales.registered_by` sin ON DELETE** | `sales` | FK sin accion referencial; si se elimina el registrador, la FK falla |
| **XP se calcula en Edge Function** | Edge Function | La logica de XP deberia vivir en un trigger para garantizar consistencia |

### Correcciones Propuestas

**a) CHECK constraints:**
```sql
ALTER TABLE sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0);
ALTER TABLE sales ADD CONSTRAINT sales_xp_non_negative CHECK (xp_earned >= 0);
ALTER TABLE products ADD CONSTRAINT products_xp_positive CHECK (xp_value > 0);
ALTER TABLE levels ADD CONSTRAINT levels_xp_range CHECK (min_xp >= 0 AND max_xp > min_xp);
ALTER TABLE profiles ADD CONSTRAINT profiles_xp_non_negative CHECK (xp >= 0);
ALTER TABLE profiles ADD CONSTRAINT profiles_streak_non_negative CHECK (streak >= 0);
ALTER TABLE profiles ADD CONSTRAINT profiles_shields_non_negative CHECK (shields >= 0);
ALTER TABLE medals ADD CONSTRAINT medals_condition_positive CHECK (condition_value > 0);
```

**b) Corregir FK sin ON DELETE:**
```sql
ALTER TABLE sales DROP CONSTRAINT sales_registered_by_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_registered_by_fkey 
  FOREIGN KEY (registered_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE sales_uploads DROP CONSTRAINT sales_uploads_uploaded_by_fkey;
ALTER TABLE sales_uploads ADD CONSTRAINT sales_uploads_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
```

**c) Trigger para calcular XP automaticamente:**
```sql
CREATE OR REPLACE FUNCTION calculate_sale_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SELECT xp_value * NEW.quantity INTO NEW.xp_earned
  FROM products WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_sale_xp
  BEFORE INSERT ON sales FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_xp();
```

---

## 4. Indices de Rendimiento Faltantes

```sql
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_profiles_manager_id ON profiles(manager_id);
CREATE INDEX idx_profiles_cell_id ON profiles(cell_id);
CREATE INDEX idx_user_medals_user_id ON user_medals(user_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

---

## Plan de Ejecucion (Orden de Migraciones)

| Paso | Migracion | Riesgo | Impacto en Codigo |
|------|-----------|--------|-------------------|
| 1 | CHECK constraints | Bajo | Ninguno |
| 2 | Indices de rendimiento | Bajo | Ninguno |
| 3 | Corregir FKs sin ON DELETE | Bajo | Ninguno |
| 4 | Corregir roles `{public}` -> `{authenticated}` en `manager_cells` | Bajo | Ninguno |
| 5 | Agregar politicas INSERT para sales | Bajo | Ninguno |
| 6 | Habilitar `verify_jwt = true` en Edge Functions | Medio | Verificar que las llamadas envien Authorization header |
| 7 | Convertir `profiles.level` a FK `level_id` | Alto | Requiere actualizar todo el codigo que lee/escribe `level` |
| 8 | Eliminar `profiles.segment` | Alto | Requiere actualizar queries y vistas para JOIN con `cells` |

### Recomendacion de Ejecucion

Ejecutar los pasos 1-6 primero (bajo riesgo, alto beneficio en seguridad e integridad). Los pasos 7-8 son refactors mas grandes que requieren cambios coordinados en frontend + backend + edge functions, y se pueden planificar como fase 2.

---

## Cambios en Codigo (Fase 1)

- `supabase/config.toml`: Cambiar `verify_jwt = false` a `true`
- Verificar que `BulkSalesUpload.tsx` y cualquier llamada a edge functions envie el header de Authorization correctamente (ya lo hacen actualmente)
- No se requieren cambios adicionales en frontend para los pasos 1-6
