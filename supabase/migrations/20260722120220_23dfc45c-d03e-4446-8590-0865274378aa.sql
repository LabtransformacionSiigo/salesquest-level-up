
UPDATE public.gerentes SET canal = 'VN_EMPRESARIOS'
WHERE activo AND pais = 'COL' AND canal = 'VN_ALIADOS'
  AND nombre IN ('Jenny Snedy Torres Nuñez','Zulma Katherine Espinosa Guia','Maria Fernanda Herrera Forero');

CREATE TABLE IF NOT EXISTS public.gerentes_vn_oficiales (
  gerente_id uuid PRIMARY KEY REFERENCES public.gerentes(id) ON DELETE CASCADE,
  nombre_oficial text NOT NULL,
  celula_oficial text,
  canal text NOT NULL,
  pais text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gerentes_vn_oficiales TO authenticated;
GRANT ALL ON public.gerentes_vn_oficiales TO service_role;

ALTER TABLE public.gerentes_vn_oficiales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lectura autenticados gerentes_vn_oficiales" ON public.gerentes_vn_oficiales;
CREATE POLICY "lectura autenticados gerentes_vn_oficiales"
  ON public.gerentes_vn_oficiales FOR SELECT TO authenticated USING (true);

DELETE FROM public.gerentes_vn_oficiales;
INSERT INTO public.gerentes_vn_oficiales (gerente_id, nombre_oficial, celula_oficial, canal, pais)
SELECT g.id, x.nombre_oficial, x.celula_oficial, x.canal, x.pais
FROM (VALUES
 ('Jesus Daniel Arzuza Roman','Jesus Arzuza','Equipo Costa Oriente','VN_ALIADOS','COL'),
 ('Juvenal Reyes Silva','Juvenal Reyes','Equipo Oriente','VN_ALIADOS','COL'),
 ('Leida Adriana Rico Herrera','Leida Adriana Rico','Equipo Bogota Adriana','VN_ALIADOS','COL'),
 ('Diana Mercedes Moncada Peraza','Diana Moncada','Equipo Bogota Diana','VN_ALIADOS','COL'),
 ('Leonardo Fernandez Bautista','Leonardo Fernandez','Equipo Bogota Leonardo','VN_ALIADOS','COL'),
 ('Jaime Alberto Orozco Posso','Jaime Alberto Orozco','Equipo Bogota Jaime','VN_ALIADOS','COL'),
 ('Catalina Lizarralde Gaviria','Catalina Lizarralde','Equipo Bogota Catalina','VN_ALIADOS','COL'),
 ('John Alexander Cardona Hurtado','John Cardona','Equipo Occidente','VN_ALIADOS','COL'),
 ('Daniel Eduardo Pinto Cepeda','Daniel Pinto','Equipo Sur','VN_ALIADOS','COL'),
 ('Diana Maria Naranjo Mattheus','Diana Naranjo','Equipo Antioquia','VN_ALIADOS','COL'),
 ('Vicky Alejandra Hernandez Mendez','Vicky Hernandez','Equipo Bogota Vicky','VN_ALIADOS','COL'),
 ('Gonzalo Andres Niño Villamizar','Andres Niño','Equipo Bogota Andres','VN_ALIADOS','COL'),
 ('Yeraldin Ospina Talero','Yeraldin Ospina Talero','Equipo Bogota Yeraldin','VN_ALIADOS','COL'),
 ('Cristhian Fernando Lopez Piedrahita','Cristhian Lopez','Equipo Bogota Cristhian','VN_ALIADOS','COL'),
 ('Anderson David Martinez Gomez','Anderson David Martinez Gomez',NULL,'VN_ALIADOS','MEX'),
 ('Carolina Ramirez Jaramillo','Carolina Ramirez Jaramillo',NULL,'VN_ALIADOS','MEX'),
 ('Lady Catalina Parra Maury','Lady Catalina Parra Maury',NULL,'VN_ALIADOS','MEX'),
 ('Cielo Dirley Contreras Sabogal','Cielo Dirley Contreras Sabogal',NULL,'VN_ALIADOS','MEX'),
 ('Fernando Andres Osorno Molina','Fernando Andres Osorno Molina',NULL,'VN_ALIADOS','MEX'),
 ('Julian David Martinez Lara','Julian David Martinez Lara',NULL,'VN_ALIADOS','MEX'),
 ('Karen Lorena Puentes','Karen Lorena Puentes Peña',NULL,'VN_ALIADOS','MEX'),
 ('Lina Maria Quintero Neira','Lina Maria Quintero Neira',NULL,'VN_ALIADOS','MEX'),
 ('Maria Del Mar Quintero Gomez','Maria Del Mar Quintero Gomez',NULL,'VN_ALIADOS','MEX'),
 ('Maria Erlly Rincon Bravo','Maria Erlly Rincon Bravo',NULL,'VN_ALIADOS','MEX'),
 ('Victor Alexis Buitrago Garay','Victor Alexis Buitrago Garay',NULL,'VN_ALIADOS','MEX'),
 ('Grace Alejandra Serje Sanchez','Grace Alejandra Serje Sanchez',NULL,'VN_EMPRESARIOS','MEX'),
 ('Jhonathan Smith Zamudio Bello','Jhonathan Smith Zamudio Bello',NULL,'VN_EMPRESARIOS','MEX'),
 ('Julio Cesar Rodriguez Castro','Julio Cesar Rodriguez Castro',NULL,'VN_EMPRESARIOS','MEX'),
 ('Katerine Alexandra Salamanca Guerra','Katerine Alexandra Salamanca Guerra',NULL,'VN_EMPRESARIOS','MEX'),
 ('Viviana Baracaldo Betancourth','Viviana Baracaldo Betancourth',NULL,'VN_EMPRESARIOS','MEX'),
 ('David Alfredo Sanchez Bastidas','David Alfredo Sanchez Bastidas','DG1','VN_EMPRESARIOS','COL'),
 ('Andres Felipe Baron Ballen','Andres Felipe Baron Ballen','DG3','VN_EMPRESARIOS','COL'),
 ('Jenny Snedy Torres Nuñez','Jenny Snedy Torres Nuñez','DG4','VN_EMPRESARIOS','COL'),
 ('Zulma Katherine Espinosa Guia','Zulma Katherine Espinosa Guia','DG6','VN_EMPRESARIOS','COL'),
 ('Luis Antonio Arevalo Leon','Luis Antonio Arevalo Leon','DG7','VN_EMPRESARIOS','COL'),
 ('Sonia Del Pilar Malagon Diaz','Sonia Del Pilar Malagon Diaz','DG8','VN_EMPRESARIOS','COL'),
 ('Maria Fernanda Herrera Forero','Maria Fernanda Herrera','DG9','VN_EMPRESARIOS','COL'),
 ('Angel Daniel Torres Herrera','Angel Daniel Torres Herrera','Equipo Daniel','VN_EMPRESARIOS','COL'),
 ('David Stiven Capera Silva','David Stiven Capera Silva','Equipo David','VN_EMPRESARIOS','COL'),
 ('Diana Marcela Arguello Culma','Diana Marcela Arguello Culma','Equipo DianaM','VN_EMPRESARIOS','COL'),
 ('Diego Mauricio Bohorquez Munar','Diego Mauricio Bohorquez Munar','Equipo Diego','VN_EMPRESARIOS','COL'),
 ('Jordan Hernandez Villegas','Jordan Hernandez Villegas','Equipo Jordan','VN_EMPRESARIOS','COL'),
 ('Maritza Cristina Robledo Piñeros','Maritza Cristina Robledo Piñeros','Equipo Maritza','VN_EMPRESARIOS','COL'),
 ('Sergio Arturo Florez Jimenez','Sergio Arturo Florez Jimenez','Equipo Sergio','VN_EMPRESARIOS','COL'),
 ('Yeferson Estiben Machado Gaviria','Yeferson Estiben Machado Gaviria','Equipo Yeferson','VN_EMPRESARIOS','COL')
) AS x(nombre_bd, nombre_oficial, celula_oficial, canal, pais)
JOIN public.gerentes g
  ON g.nombre = x.nombre_bd AND g.canal = x.canal AND g.pais = x.pais AND g.activo
ON CONFLICT (gerente_id) DO NOTHING;
