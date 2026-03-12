
-- Assign admin role to alejandro.rivas (first test user)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role FROM public.gerentes WHERE email = 'alejandro.rivas@siigo.com'
ON CONFLICT DO NOTHING;

-- Assign gerente role to all existing gerentes with user_id
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'gerente'::app_role FROM public.gerentes WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Seed some asesores for testing
INSERT INTO public.asesores (gerente_id, nombre, email, canal, pais) VALUES
  ((SELECT id FROM gerentes WHERE email = 'alejandro.rivas@siigo.com'), 'Carlos López Martínez', 'carlos.lopez@siigo.com', 'VN_ALIADOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'alejandro.rivas@siigo.com'), 'Diana Ruiz Sánchez', 'diana.ruiz@siigo.com', 'VN_ALIADOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'alejandro.rivas@siigo.com'), 'Pedro Gómez Torres', 'pedro.gomez@siigo.com', 'VN_ALIADOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'ana.guerrero@siigo.com'), 'Laura Méndez Díaz', 'laura.mendez@siigo.com', 'VC', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'ana.guerrero@siigo.com'), 'Roberto Castillo', 'roberto.castillo@siigo.com', 'VC', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'luis.avila@siigo.com'), 'Fernanda Ortiz', 'fernanda.ortiz@siigo.com', 'VN_EMPRESARIOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'luis.avila@siigo.com'), 'Andrés Navarro', 'andres.navarro@siigo.com', 'VN_EMPRESARIOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'luis.avila@siigo.com'), 'Sofía Herrera', 'sofia.herrera@siigo.com', 'VN_EMPRESARIOS', 'MEX'),
  ((SELECT id FROM gerentes WHERE email = 'luis.avila@siigo.com'), 'Miguel Ángel Reyes', 'miguel.reyes@siigo.com', 'VN_EMPRESARIOS', 'MEX');
