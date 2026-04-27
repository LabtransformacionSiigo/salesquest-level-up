
-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'asesor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create asesores table
CREATE TABLE public.asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid REFERENCES public.gerentes(id) ON DELETE CASCADE NOT NULL,
  nombre text NOT NULL,
  email text NOT NULL,
  canal text,
  pais text,
  activo boolean DEFAULT true,
  avatar_url text,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.asesores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view asesores" ON public.asesores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage asesores" ON public.asesores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerentes can view own asesores" ON public.asesores
  FOR SELECT TO authenticated
  USING (gerente_id IN (SELECT id FROM gerentes WHERE user_id = auth.uid()));

-- 3. Create catalogo_medallas table (per channel, product-based)
CREATE TABLE public.catalogo_medallas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  condicion_tipo text NOT NULL DEFAULT 'primera_venta',
  producto text,
  cantidad_requerida integer DEFAULT 1,
  sp integer NOT NULL DEFAULT 100,
  emoji text DEFAULT '🏅',
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.catalogo_medallas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalogo" ON public.catalogo_medallas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage catalogo" ON public.catalogo_medallas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create config_rachas table (channel-specific streak configs)
CREATE TABLE public.config_rachas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  condicion_tipo text NOT NULL DEFAULT 'ventas_semanales',
  umbral_verde numeric DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now()
);

ALTER TABLE public.config_rachas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view config_rachas" ON public.config_rachas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage config_rachas" ON public.config_rachas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add admin policies to gerentes for admin CRUD
CREATE POLICY "Admins can insert gerentes" ON public.gerentes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all gerentes" ON public.gerentes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gerentes" ON public.gerentes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Seed default medal catalog per channel
INSERT INTO public.catalogo_medallas (canal, nombre, descripcion, condicion_tipo, producto, cantidad_requerida, sp, emoji) VALUES
  -- VN_EMPRESARIOS
  ('VN_EMPRESARIOS', 'Primera Venta Nube', 'Realiza tu primera venta de producto Nube', 'primera_venta', 'Nube', 1, 150, '☁️'),
  ('VN_EMPRESARIOS', 'Primera Venta FE', 'Realiza tu primera venta de Facturación Electrónica', 'primera_venta', 'FE', 1, 150, '📄'),
  ('VN_EMPRESARIOS', 'Primera Venta Nómina-e', 'Realiza tu primera venta de Nómina Electrónica', 'primera_venta', 'Nomina-e', 1, 150, '💼'),
  ('VN_EMPRESARIOS', '10 Ventas Nube', 'Acumula 10 ventas de Nube', 'cantidad', 'Nube', 10, 300, '🌩️'),
  ('VN_EMPRESARIOS', '10 Ventas FE', 'Acumula 10 ventas de FE', 'cantidad', 'FE', 10, 300, '📋'),
  ('VN_EMPRESARIOS', 'Cumplimiento 100%', 'Cumple el 100% de tu meta mensual', 'cumplimiento', NULL, 100, 500, '✅'),
  -- VN_ALIADOS
  ('VN_ALIADOS', 'Primera Venta Nube', 'Realiza tu primera venta de producto Nube', 'primera_venta', 'Nube', 1, 150, '☁️'),
  ('VN_ALIADOS', 'Primera Venta FE', 'Realiza tu primera venta de FE', 'primera_venta', 'FE', 1, 150, '📄'),
  ('VN_ALIADOS', 'Primera Venta Nómina-e', 'Realiza tu primera venta de Nómina-e', 'primera_venta', 'Nomina-e', 1, 150, '💼'),
  ('VN_ALIADOS', 'Primer Referido', 'Genera tu primer referido exitoso', 'primera_venta', 'Referido', 1, 200, '🤝'),
  ('VN_ALIADOS', '5 Referidos', 'Acumula 5 referidos exitosos', 'cantidad', 'Referido', 5, 400, '👥'),
  ('VN_ALIADOS', 'Cumplimiento 100%', 'Cumple el 100% de tu meta mensual', 'cumplimiento', NULL, 100, 500, '✅'),
  -- VC
  ('VC', 'Primera Conversión', 'Realiza tu primera conversión', 'primera_venta', 'Conversiones', 1, 150, '🔄'),
  ('VC', 'Primera Venta FE', 'Realiza tu primera venta de FE en VC', 'primera_venta', 'FE', 1, 150, '📄'),
  ('VC', 'Primera Venta Nómina-e', 'Realiza tu primera venta de Nómina-e en VC', 'primera_venta', 'Nomina-e', 1, 150, '💼'),
  ('VC', '10 Conversiones', 'Acumula 10 conversiones', 'cantidad', 'Conversiones', 10, 300, '🔁'),
  ('VC', 'ACV $10M', 'Alcanza $10M en ACV', 'monto', NULL, 10000000, 500, '💰'),
  ('VC', 'ACV $50M', 'Alcanza $50M en ACV', 'monto', NULL, 50000000, 1000, '🏆');

-- 7. Seed default racha config per channel
INSERT INTO public.config_rachas (canal, nombre, descripcion, condicion_tipo, umbral_verde) VALUES
  ('VN_EMPRESARIOS', 'Racha de Ventas', 'Semanas consecutivas con ventas superiores al umbral', 'ventas_semanales', 50000000),
  ('VN_ALIADOS', 'Racha de Ventas', 'Semanas consecutivas con ventas superiores al umbral', 'ventas_semanales', 40000000),
  ('VN_ALIADOS', 'Racha de Referidos', 'Semanas consecutivas generando al menos 1 referido', 'referidos_semanales', 1),
  ('VC', 'Racha ACV', 'Semanas consecutivas con ACV positivo', 'acv_semanal', 5000000),
  ('VC', 'Racha de Conversiones', 'Semanas consecutivas con al menos 1 conversión', 'conversiones_semanales', 1);

-- 8. Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;
