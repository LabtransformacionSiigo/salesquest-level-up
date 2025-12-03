-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('ADMINISTRADOR', 'GERENTE', 'EJECUTIVO');

-- Create enum for segments
CREATE TYPE public.segment_type AS ENUM ('Empresarios', 'Aliados', 'B&M', 'Despachos');

-- Create cells table
CREATE TABLE public.cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  segment segment_type NOT NULL,
  country TEXT NOT NULL,
  goal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '👤',
  xp INTEGER DEFAULT 0,
  level TEXT DEFAULT 'Novato',
  streak INTEGER DEFAULT 0,
  shields INTEGER DEFAULT 0,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cell_id UUID REFERENCES public.cells(id) ON DELETE SET NULL,
  country TEXT,
  segment segment_type,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  xp_value INTEGER NOT NULL DEFAULT 10,
  icon TEXT DEFAULT '📦',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  client_name TEXT NOT NULL,
  notes TEXT,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  registered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create levels table
CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  min_xp INTEGER NOT NULL,
  max_xp INTEGER NOT NULL,
  icon TEXT DEFAULT '⭐',
  color TEXT DEFAULT '#3B82F6',
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Create medals table
CREATE TABLE public.medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏅',
  category TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_medals table (earned medals)
CREATE TABLE public.user_medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medal_id UUID NOT NULL REFERENCES public.medals(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, medal_id)
);

-- Enable RLS on all tables
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_medals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for cells
CREATE POLICY "Everyone can view cells" ON public.cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cells" ON public.cells FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));
CREATE POLICY "Managers can view team profiles" ON public.profiles FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));
CREATE POLICY "Managers can manage team profiles" ON public.profiles FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'GERENTE') AND manager_id = auth.uid()
);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for products
CREATE POLICY "Everyone can view active products" ON public.products FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for sales
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Managers can view team sales" ON public.sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = public.sales.user_id AND manager_id = auth.uid())
);
CREATE POLICY "Admins can view all sales" ON public.sales FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for levels
CREATE POLICY "Everyone can view levels" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage levels" ON public.levels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for medals
CREATE POLICY "Everyone can view medals" ON public.medals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage medals" ON public.medals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- RLS Policies for user_medals
CREATE POLICY "Users can view own medals" ON public.user_medals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage user medals" ON public.user_medals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMINISTRADOR'));

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '👤')
  );
  
  -- Default role is EJECUTIVO
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'EJECUTIVO'));
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default levels
INSERT INTO public.levels (name, min_xp, max_xp, icon, color, order_index) VALUES
  ('Novato', 0, 99, '🌱', '#10B981', 1),
  ('Junior', 100, 299, '⭐', '#3B82F6', 2),
  ('Senior', 300, 599, '🌟', '#8B5CF6', 3),
  ('Expert', 600, 999, '💎', '#F59E0B', 4),
  ('Master', 1000, 999999, '👑', '#EF4444', 5);

-- Insert default products
INSERT INTO public.products (name, description, xp_value, icon) VALUES
  ('Producto Básico', 'Producto de entrada', 10, '📦'),
  ('Producto Premium', 'Producto de alta gama', 25, '💎'),
  ('Servicio Consultoría', 'Servicio de asesoría', 50, '💼');

-- Insert initial cells
INSERT INTO public.cells (name, segment, country, goal) VALUES
  ('CEL-001', 'Empresarios', 'Colombia', 'Meta Q1 2024'),
  ('CEL-002', 'Aliados', 'México', 'Expansión regional');