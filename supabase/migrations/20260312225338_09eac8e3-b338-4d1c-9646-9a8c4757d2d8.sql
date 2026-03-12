
-- Clean existing data
DELETE FROM sp_acumulados;
DELETE FROM reconocimientos;
DELETE FROM retos_completados;
DELETE FROM medallas;
DELETE FROM rachas;
DELETE FROM kpis_mensuales;
DELETE FROM ventas;
DELETE FROM gerentes;

-- GERENTES: VN_ALIADOS
INSERT INTO gerentes (nombre, email, canal, pais, lider) VALUES
('Jenny Jisset Martínez', 'jenny.martinez@siigo.com', 'VN_ALIADOS', 'MEX', 'Jorge De Brigard'),
('Maritza Camelo Duarte', 'maritza.camelo@siigo.com', 'VN_ALIADOS', 'MEX', 'Juan Diego Avilán'),
('Alejandro Rivas Cruz', 'alejandro.rivas@siigo.com', 'VN_ALIADOS', 'MEX', 'Jorge De Brigard'),
('Sandra Gutiérrez Melo', 'sandra.gutierrez@siigo.com', 'VN_ALIADOS', 'MEX', 'Jorge De Brigard'),
('Tomás Navarro Peña', 'tomas.navarro@siigo.com', 'VN_ALIADOS', 'MEX', 'Juan Diego Avilán'),
('Cristina Varela Soto', 'cristina.varela@siigo.com', 'VN_ALIADOS', 'MEX', 'Paola Tapias'),
('Rodrigo Méndez Luna', 'rodrigo.mendez@siigo.com', 'VN_ALIADOS', 'MEX', 'Jorge De Brigard'),
('Patricia Herrera Ríos', 'patricia.herrera@siigo.com', 'VN_ALIADOS', 'MEX', 'Jorge De Brigard');

-- GERENTES: VC
INSERT INTO gerentes (nombre, email, canal, pais, lider) VALUES
('Héctor Serrano Leal', 'hector.serrano@siigo.com', 'VC', 'MEX', 'Roberto Peña Salinas'),
('Valeria Ríos Domínguez', 'valeria.rios@siigo.com', 'VC', 'MEX', 'Roberto Peña Salinas'),
('Ana Guerrero Téllez', 'ana.guerrero@siigo.com', 'VC', 'MEX', 'Jaime Flores Gutiérrez'),
('Patricia Núñez Aguilar', 'patricia.nunez@siigo.com', 'VC', 'MEX', 'Jaime Flores Gutiérrez'),
('Laura Gómez Varela', 'laura.gomez@siigo.com', 'VC', 'MEX', 'Claudia Montes Arriaga'),
('Ernesto Díaz Montoya', 'ernesto.diaz@siigo.com', 'VC', 'MEX', 'Jaime Flores Gutiérrez'),
('Carlos Mendoza Ibarra', 'carlos.mendoza@siigo.com', 'VC', 'MEX', 'Roberto Peña Salinas');

-- GERENTES: VN_EMPRESARIOS
INSERT INTO gerentes (nombre, email, canal, pais, lider) VALUES
('Gabriela Torres Núñez', 'gabriela.torres@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Diego Hernández Luna'),
('Marco Sánchez Peña', 'marco.sanchez@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Sofía Ramírez Vega'),
('Fernanda Ruiz Vargas', 'fernanda.ruiz@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Diego Hernández Luna'),
('Karla Morales Reyes', 'karla.morales@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Diego Hernández Luna'),
('Luis Ávila Mendoza', 'luis.avila@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Diego Hernández Luna'),
('Alejandro Vega Ortega', 'alejandro.vega@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Diego Hernández Luna'),
('Andrés Castillo Fuentes', 'andres.castillo@siigo.com', 'VN_EMPRESARIOS', 'MEX', 'Paola Jiménez Soto');

-- KPIs MENSUALES
INSERT INTO kpis_mensuales (gerente_id, anio_mes, canal, ventas, meta, acv_f, cant_recomendados, ventas_recomendados, sc_creados, ventas_sql, sa_creados, hc_inicial, hc_final, terminaciones)
SELECT g.id, '202601', 'VN_ALIADOS', 28372287.01, 25000000, 26345355.24, 38, 10140633.1, 29, 12776662.99, 33, 15, 13, 2 FROM gerentes g WHERE g.nombre='Jenny Jisset Martínez'
UNION ALL SELECT g.id, '202602', 'VN_ALIADOS', 21531338.88, 35000000, 27439852.86, 44, 9425925.55, 53, 19059691.16, 11, 16, 14, 2 FROM gerentes g WHERE g.nombre='Jenny Jisset Martínez'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 31820638.81, 30000000, 40908070.97, 22, 12349637.01, 22, 10213722.16, 37, 15, 15, 2 FROM gerentes g WHERE g.nombre='Maritza Camelo Duarte'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 47531569.61, 35000000, 55601932.82, 62, 53912258.29, 145, 33302979.53, 31, 9, 8, 1 FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, '202602', 'VN_ALIADOS', 47728971.44, 25000000, 60407674.05, 18, 5604054.28, 44, 18706397.75, 28, 12, 12, 2 FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, '202603', 'VN_ALIADOS', 40003038.73, 35000000, 40500716.76, 52, 33301907.51, 42, 12327792.93, 9, 13, 13, 0 FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 48537491.37, 25000000, 51845504.41, 15, 7783024.64, 95, 16456339.36, 35, 13, 12, 1 FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, '202602', 'VN_ALIADOS', 19404678.23, 30000000, 21040301.35, 46, 39424154.69, 28, 5862636.52, 6, 12, 12, 0 FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, '202603', 'VN_ALIADOS', 41206278.75, 35000000, 38904380.91, 11, 7389967.9, 79, 31441265.54, 10, 9, 10, 1 FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 29464939.5, 35000000, 28017982.08, 65, 55562364.49, 107, 33935397.6, 39, 18, 19, 1 FROM gerentes g WHERE g.nombre='Tomás Navarro Peña'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 24324073.78, 25000000, 24976265.09, 44, 15031041.9, 31, 10479009.01, 36, 14, 15, 0 FROM gerentes g WHERE g.nombre='Cristina Varela Soto'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 24815412.11, 30000000, 31291184.95, 74, 52682127.72, 84, 26723710.29, 17, 13, 13, 0 FROM gerentes g WHERE g.nombre='Rodrigo Méndez Luna'
UNION ALL SELECT g.id, '202602', 'VN_ALIADOS', 23786577.67, 25000000, 27621993.69, 67, 21731477.37, 104, 49637769.04, 29, 11, 13, 0 FROM gerentes g WHERE g.nombre='Rodrigo Méndez Luna'
UNION ALL SELECT g.id, '202603', 'VN_ALIADOS', 20109565.5, 30000000, 22457699.98, 23, 19888818.29, 55, 5713443.78, 10, 17, 17, 1 FROM gerentes g WHERE g.nombre='Rodrigo Méndez Luna'
UNION ALL SELECT g.id, '202601', 'VN_ALIADOS', 32763765.07, 30000000, 39823012.0, 16, 9279479.64, 116, 37501660.13, 6, 8, 9, 1 FROM gerentes g WHERE g.nombre='Patricia Herrera Ríos'
UNION ALL SELECT g.id, '202602', 'VN_ALIADOS', 27701174.52, 25000000, 34637232.57, 66, 58868023.0, 83, 24745290.01, 40, 18, 19, 1 FROM gerentes g WHERE g.nombre='Patricia Herrera Ríos';

-- VENTAS VC
INSERT INTO ventas (gerente_id, canal, fecha_facturacion, mes, anio, bloque_venta, producto, documento_factura, acv_plus, valor_producto)
SELECT g.id, 'VC', '2026-01-26'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Lite Paquete 10 Empleados', 'F-93-230000', 650262.28, 490926.43 FROM gerentes g WHERE g.nombre='Héctor Serrano Leal'
UNION ALL SELECT g.id, 'VC', '2026-02-28'::date, 'Febrero', 2026, 'FE', 'Siigo DOC PRO 1000 Fac', 'F-93-230289', 307029.43, 670009.15 FROM gerentes g WHERE g.nombre='Valeria Ríos Domínguez'
UNION ALL SELECT g.id, 'VC', '2026-01-24'::date, 'Enero', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-93-230578', 454738.81, 534781.01 FROM gerentes g WHERE g.nombre='Ana Guerrero Téllez'
UNION ALL SELECT g.id, 'VC', '2026-03-24'::date, 'Marzo', 2026, 'Conversiones', 'Conversión a Activacion FE 300 Fac', 'F-93-230867', 1376986.82, 1542661.62 FROM gerentes g WHERE g.nombre='Patricia Núñez Aguilar'
UNION ALL SELECT g.id, 'VC', '2026-01-08'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Lite Paquete 25 Empleados', 'F-93-231156', 346161.08, 316092.05 FROM gerentes g WHERE g.nombre='Valeria Ríos Domínguez'
UNION ALL SELECT g.id, 'VC', '2026-02-15'::date, 'Febrero', 2026, 'Nomina-e', 'Nómina Pro 50 Empleados', 'F-93-231445', 430371.43, 638606.23 FROM gerentes g WHERE g.nombre='Patricia Núñez Aguilar'
UNION ALL SELECT g.id, 'VC', '2026-02-09'::date, 'Febrero', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-93-231734', 588041.52, 353354.64 FROM gerentes g WHERE g.nombre='Laura Gómez Varela'
UNION ALL SELECT g.id, 'VC', '2026-03-03'::date, 'Marzo', 2026, 'Nomina-e', 'Nómina Lite Paquete 25 Empleados', 'F-93-232023', 499046.36, 319890.92 FROM gerentes g WHERE g.nombre='Laura Gómez Varela'
UNION ALL SELECT g.id, 'VC', '2026-03-25'::date, 'Marzo', 2026, 'Conversiones', 'Conversión a Activacion FE 300 Fac', 'F-93-232312', 530774.41, 794422.28 FROM gerentes g WHERE g.nombre='Patricia Núñez Aguilar'
UNION ALL SELECT g.id, 'VC', '2026-03-12'::date, 'Marzo', 2026, 'FE', 'Siigo DOC PRO 1000 Fac', 'F-93-232601', 885084.54, 654960.4 FROM gerentes g WHERE g.nombre='Ana Guerrero Téllez'
UNION ALL SELECT g.id, 'VC', '2026-03-07'::date, 'Marzo', 2026, 'Conversiones', 'Conversión a Activacion FE 300 Fac', 'F-93-232890', 1019692.5, 484038.66 FROM gerentes g WHERE g.nombre='Ana Guerrero Téllez'
UNION ALL SELECT g.id, 'VC', '2026-03-15'::date, 'Marzo', 2026, 'FE', 'Activacion FE 300 Fac', 'F-93-233179', 321552.96, 191704.73 FROM gerentes g WHERE g.nombre='Ernesto Díaz Montoya'
UNION ALL SELECT g.id, 'VC', '2026-02-02'::date, 'Febrero', 2026, 'Conversiones', 'Conversión a Siigo Nube Premium', 'F-93-233468', 1617206.71, 1187773.11 FROM gerentes g WHERE g.nombre='Carlos Mendoza Ibarra'
UNION ALL SELECT g.id, 'VC', '2026-01-05'::date, 'Enero', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-93-233757', 475668.21, 402894.1 FROM gerentes g WHERE g.nombre='Laura Gómez Varela'
UNION ALL SELECT g.id, 'VC', '2026-02-12'::date, 'Febrero', 2026, 'Nomina-e', 'Nómina Lite Paquete 25 Empleados', 'F-93-234046', 232292.89, 538964.49 FROM gerentes g WHERE g.nombre='Valeria Ríos Domínguez'
UNION ALL SELECT g.id, 'VC', '2026-02-17'::date, 'Febrero', 2026, 'Conversiones', 'Conversión a Activacion FE 300 Fac', 'F-93-234335', NULL, 1401610.49 FROM gerentes g WHERE g.nombre='Ana Guerrero Téllez'
UNION ALL SELECT g.id, 'VC', '2026-01-22'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Lite Paquete 10 Empleados', 'F-93-234624', 541169.53, 242069.45 FROM gerentes g WHERE g.nombre='Valeria Ríos Domínguez'
UNION ALL SELECT g.id, 'VC', '2026-03-01'::date, 'Marzo', 2026, 'Nomina-e', 'Nómina Lite Paquete 10 Empleados', 'F-93-234913', 749577.68, 383538.47 FROM gerentes g WHERE g.nombre='Héctor Serrano Leal'
UNION ALL SELECT g.id, 'VC', '2026-01-17'::date, 'Enero', 2026, 'FE', 'Siigo DOC PRO 1000 Fac', 'F-93-235202', 758056.54, 732086.46 FROM gerentes g WHERE g.nombre='Carlos Mendoza Ibarra'
UNION ALL SELECT g.id, 'VC', '2026-01-14'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Pro 50 Empleados', 'F-93-235491', 456318.56, 579099.09 FROM gerentes g WHERE g.nombre='Ernesto Díaz Montoya';

-- VENTAS VN_EMPRESARIOS
INSERT INTO ventas (gerente_id, canal, fecha_facturacion, mes, anio, bloque_venta, producto, documento_factura, acv_plus, valor_producto)
SELECT g.id, 'VN_EMPRESARIOS', '2026-01-06'::date, 'Enero', 2026, 'Nube', 'Siigo Nube Contabilidad', 'F-94-1420000', 1009400.98, 977334.81 FROM gerentes g WHERE g.nombre='Gabriela Torres Núñez'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-18'::date, 'Marzo', 2026, 'Nomina-e', 'Nómina Pro 50 Empleados', 'F-94-1420317', 416326.14, 408157.64 FROM gerentes g WHERE g.nombre='Marco Sánchez Peña'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-15'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Pro 50 Empleados', 'F-94-1420634', 590833.63, 653920.95 FROM gerentes g WHERE g.nombre='Marco Sánchez Peña'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-05'::date, 'Marzo', 2026, 'Nube', 'Siigo Nube Premium Profesional', 'F-94-1420951', 3905823.68, 3433808.52 FROM gerentes g WHERE g.nombre='Fernanda Ruiz Vargas'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-09'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Lite Paquete 10 Empleados', 'F-94-1421268', 450983.22, 402735.91 FROM gerentes g WHERE g.nombre='Karla Morales Reyes'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-06'::date, 'Febrero', 2026, 'FE', 'Activacion FE 300 Fac', 'F-94-1421585', 797140.67, 873411.22 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-07'::date, 'Febrero', 2026, 'Nube', 'Siigo Nube Contabilidad', 'F-94-1421902', 1188202.28, 1144643.44 FROM gerentes g WHERE g.nombre='Alejandro Vega Ortega'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-26'::date, 'Febrero', 2026, 'Nomina-e', 'Nómina Lite Paquete 25 Empleados', 'F-94-1422219', 629984.81, 613549.05 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-12'::date, 'Enero', 2026, 'Nube', 'Siigo Nube Contabilidad', 'F-94-1422536', 3799797.71, 3981556.6 FROM gerentes g WHERE g.nombre='Andrés Castillo Fuentes'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-10'::date, 'Febrero', 2026, 'Nube', 'Siigo Nube Empresarial', 'F-94-1422853', 1346103.57, 1344469.59 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-27'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Lite Paquete 10 Empleados', 'F-94-1423170', 740672.57, 791465.08 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-19'::date, 'Febrero', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-94-1423487', 553827.26, 530708.83 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-23'::date, 'Enero', 2026, 'Nomina-e', 'Nómina Pro 50 Empleados', 'F-94-1423804', 235876.82, 216832.4 FROM gerentes g WHERE g.nombre='Fernanda Ruiz Vargas'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-27'::date, 'Febrero', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-94-1424121', 793854.94, 902928.37 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-24'::date, 'Marzo', 2026, 'FE', 'Siigo DOC PRO 500 Fac', 'F-94-1424438', 597103.61, 589400.79 FROM gerentes g WHERE g.nombre='Marco Sánchez Peña'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-07'::date, 'Marzo', 2026, 'Nube', 'Siigo Nube Empresarial', 'F-94-1424755', 3369286.04, 3109766.82 FROM gerentes g WHERE g.nombre='Alejandro Vega Ortega'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-02-11'::date, 'Febrero', 2026, 'Conversiones', 'Conversión a Siigo Nube Premium', 'F-94-1425072', 963745.51, 938771.56 FROM gerentes g WHERE g.nombre='Karla Morales Reyes'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-14'::date, 'Marzo', 2026, 'FE', 'Siigo DOC PRO 1000 Fac', 'F-94-1425389', 662738.1, 720593.02 FROM gerentes g WHERE g.nombre='Alejandro Vega Ortega'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-03-02'::date, 'Marzo', 2026, 'Nube', 'Siigo Nube Premium Profesional', 'F-94-1425706', 1824019.17, 1970355.11 FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'VN_EMPRESARIOS', '2026-01-11'::date, 'Enero', 2026, 'Nube', 'Siigo Nube Empresarial', 'F-94-1426023', 1447191.77, 1251628.21 FROM gerentes g WHERE g.nombre='Andrés Castillo Fuentes';

-- SP ACUMULADOS
INSERT INTO sp_acumulados (gerente_id, fuente, sp, periodo, detalle)
SELECT g.id, 'CONVERSION_COP', 90, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, 'CONVERSION_COP', 50, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, 'CONVERSION_COP', 30, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Maritza Camelo Duarte'
UNION ALL SELECT g.id, 'CONVERSION_COP', 20, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Jenny Jisset Martínez'
UNION ALL SELECT g.id, 'CONVERSION_COP', 30, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Patricia Herrera Ríos'
UNION ALL SELECT g.id, 'CONVERSION_COP', 20, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Tomás Navarro Peña'
UNION ALL SELECT g.id, 'CONVERSION_COP', 20, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Cristina Varela Soto'
UNION ALL SELECT g.id, 'CONVERSION_COP', 20, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Rodrigo Méndez Luna'
UNION ALL SELECT g.id, 'CONVERSION_COP', 12, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Luis Ávila Mendoza'
UNION ALL SELECT g.id, 'CONVERSION_COP', 5, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Andrés Castillo Fuentes'
UNION ALL SELECT g.id, 'CONVERSION_COP', 5, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Alejandro Vega Ortega'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Gabriela Torres Núñez'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Marco Sánchez Peña'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Fernanda Ruiz Vargas'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Karla Morales Reyes'
UNION ALL SELECT g.id, 'CONVERSION_COP', 5, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Carlos Mendoza Ibarra'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Héctor Serrano Leal'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Valeria Ríos Domínguez'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Ana Guerrero Téllez'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Patricia Núñez Aguilar'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Laura Gómez Varela'
UNION ALL SELECT g.id, 'CONVERSION_COP', 1, '2026-01', 'Ventas enero' FROM gerentes g WHERE g.nombre='Ernesto Díaz Montoya';

-- RACHAS
INSERT INTO rachas (gerente_id, semana_iso, anio, ingresos_semana, estado, semanas_consecutivas, multiplicador)
SELECT g.id, 10, 2026, 120000000, 'VERDE', 6, 1.5 FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, 10, 2026, 110000000, 'VERDE', 4, 1.25 FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, 10, 2026, 95000000, 'AMARILLA', 0, 1.0 FROM gerentes g WHERE g.nombre='Jenny Jisset Martínez'
UNION ALL SELECT g.id, 10, 2026, 105000000, 'VERDE', 2, 1.1 FROM gerentes g WHERE g.nombre='Patricia Herrera Ríos';

-- MEDALLAS
INSERT INTO medallas (gerente_id, medalla, sp_otorgados, fecha_desbloqueo)
SELECT g.id, 'primera_conquista', 100, '2026-01-15'::date FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, 'sello_cumplimiento', 300, '2026-01-31'::date FROM gerentes g WHERE g.nombre='Alejandro Rivas Cruz'
UNION ALL SELECT g.id, 'primera_conquista', 100, '2026-01-20'::date FROM gerentes g WHERE g.nombre='Sandra Gutiérrez Melo'
UNION ALL SELECT g.id, 'primera_conquista', 100, '2026-02-10'::date FROM gerentes g WHERE g.nombre='Patricia Herrera Ríos';

-- RECONOCIMIENTOS
INSERT INTO reconocimientos (de_gerente_id, para_gerente_id, tipo, sp_para, sp_de, semana_iso, anio, mensaje)
SELECT d.id, p.id, 'IMPULSO_PAR', 80, 20, 9, 2026, '¡Excelente cierre de mes, sigue así!'
FROM gerentes d, gerentes p WHERE d.nombre='Sandra Gutiérrez Melo' AND p.nombre='Alejandro Rivas Cruz'
UNION ALL
SELECT d.id, p.id, 'PALABRA_LIDERAZGO', 120, 30, 10, 2026, 'Gran liderazgo con tu equipo esta semana'
FROM gerentes d, gerentes p WHERE d.nombre='Jenny Jisset Martínez' AND p.nombre='Sandra Gutiérrez Melo'
UNION ALL
SELECT d.id, p.id, 'IMPULSO_PAR', 80, 20, 10, 2026, 'Muy buen trabajo en referidos'
FROM gerentes d, gerentes p WHERE d.nombre='Maritza Camelo Duarte' AND p.nombre='Patricia Herrera Ríos';
