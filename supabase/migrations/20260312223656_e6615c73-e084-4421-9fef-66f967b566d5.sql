
-- 1. Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop existing views
DROP VIEW IF EXISTS ranking_view CASCADE;

-- 3. Drop existing tables
DROP TABLE IF EXISTS user_medals CASCADE;
DROP TABLE IF EXISTS sales_uploads CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS manager_cells CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS medals CASCADE;
DROP TABLE IF EXISTS levels CASCADE;
DROP TABLE IF EXISTS cells CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 4. Drop existing functions
DROP FUNCTION IF EXISTS calculate_sale_xp() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- 5. Drop existing types
DROP TYPE IF EXISTS app_role CASCADE;
DROP TYPE IF EXISTS segment_type CASCADE;

-- 6. Create new tables
CREATE TABLE gerentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  canal TEXT CHECK (canal IN ('VN_EMPRESARIOS','VN_ALIADOS','VC')),
  pais TEXT CHECK (pais IN ('COL','MEX','ECU')),
  lider TEXT,
  activo BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sp_acumulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  fuente TEXT CHECK (fuente IN (
    'CONVERSION_COP','RETO_DIARIO','RETO_SEMANAL',
    'RETO_MENSUAL','MEDALLA','RECONOCIMIENTO_RECIBIDO','RECONOCIMIENTO_ENVIADO'
  )),
  sp INTEGER NOT NULL,
  periodo TEXT NOT NULL,
  detalle TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  canal TEXT CHECK (canal IN ('VN_EMPRESARIOS','VN_ALIADOS','VC')),
  fecha_facturacion DATE NOT NULL,
  mes TEXT,
  anio INTEGER,
  bloque_venta TEXT,
  producto TEXT,
  documento_factura TEXT UNIQUE,
  acv_plus NUMERIC,
  valor_producto NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE kpis_mensuales (
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  anio_mes TEXT NOT NULL,
  canal TEXT,
  ventas NUMERIC DEFAULT 0,
  meta NUMERIC DEFAULT 0,
  acv_f NUMERIC DEFAULT 0,
  cant_recomendados INTEGER DEFAULT 0,
  ventas_recomendados NUMERIC DEFAULT 0,
  sc_creados INTEGER DEFAULT 0,
  ventas_sql NUMERIC DEFAULT 0,
  sa_creados INTEGER DEFAULT 0,
  hc_inicial INTEGER DEFAULT 0,
  hc_final INTEGER DEFAULT 0,
  terminaciones INTEGER DEFAULT 0,
  PRIMARY KEY (gerente_id, anio_mes)
);

CREATE TABLE rachas (
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  semana_iso INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  ingresos_semana NUMERIC DEFAULT 0,
  estado TEXT CHECK (estado IN ('VERDE','AMARILLA','ROJA')),
  semanas_consecutivas INTEGER DEFAULT 0,
  multiplicador NUMERIC DEFAULT 1.0,
  PRIMARY KEY (gerente_id, semana_iso, anio)
);

CREATE TABLE medallas (
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  medalla TEXT NOT NULL,
  sp_otorgados INTEGER,
  fecha_desbloqueo DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (gerente_id, medalla)
);

CREATE TABLE reconocimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  para_gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN (
    'IMPULSO_PAR','PALABRA_LIDERAZGO','TROFEO_SEMANA',
    'SELLO_EXCELENCIA','RECONOCIMIENTO_CUMBRE'
  )),
  sp_para INTEGER,
  sp_de INTEGER,
  semana_iso INTEGER,
  anio INTEGER,
  mensaje TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT no_auto_reconocimiento CHECK (de_gerente_id != para_gerente_id)
);

CREATE TABLE retos_completados (
  gerente_id UUID REFERENCES gerentes(id) ON DELETE CASCADE,
  reto TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('DIARIO','SEMANAL','MENSUAL')),
  sp INTEGER,
  periodo TEXT NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (gerente_id, reto, periodo)
);

-- 7. Enable RLS
ALTER TABLE gerentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_acumulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE rachas ENABLE ROW LEVEL SECURITY;
ALTER TABLE medallas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconocimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE retos_completados ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "Authenticated can view all gerentes" ON gerentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own gerente" ON gerentes FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated can view all sp" ON sp_acumulados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sp" ON sp_acumulados FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view all ventas" ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ventas" ON ventas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view all kpis" ON kpis_mensuales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can upsert kpis" ON kpis_mensuales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view all rachas" ON rachas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can upsert rachas" ON rachas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view all medallas" ON medallas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert medallas" ON medallas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view all reconocimientos" ON reconocimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert reconocimientos" ON reconocimientos FOR INSERT TO authenticated
  WITH CHECK (de_gerente_id IN (SELECT id FROM gerentes WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated can view all retos" ON retos_completados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert retos" ON retos_completados FOR INSERT TO authenticated WITH CHECK (true);

-- 9. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sp_acumulados;

-- 10. Create views
CREATE VIEW sp_totales_gerente AS
SELECT
  g.id,
  g.nombre,
  g.canal,
  g.pais,
  g.lider,
  g.activo,
  g.avatar_url,
  g.user_id,
  COALESCE(SUM(s.sp), 0)::INTEGER AS sp_totales,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 55000 THEN 'Leyenda Siigo'
    WHEN COALESCE(SUM(s.sp),0) >= 35000 THEN 'Cima Ejecutiva'
    WHEN COALESCE(SUM(s.sp),0) >= 22000 THEN 'Élite Siigo'
    WHEN COALESCE(SUM(s.sp),0) >= 13000 THEN 'Vanguardia'
    WHEN COALESCE(SUM(s.sp),0) >= 7000  THEN 'Dominador'
    WHEN COALESCE(SUM(s.sp),0) >= 3500  THEN 'Estratega Comercial'
    WHEN COALESCE(SUM(s.sp),0) >= 1500  THEN 'Impulsor'
    WHEN COALESCE(SUM(s.sp),0) >= 500   THEN 'Ejecutor'
    ELSE 'Prospecto'
  END AS nivel,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 55000 THEN 55000
    WHEN COALESCE(SUM(s.sp),0) >= 35000 THEN 35000
    WHEN COALESCE(SUM(s.sp),0) >= 22000 THEN 22000
    WHEN COALESCE(SUM(s.sp),0) >= 13000 THEN 13000
    WHEN COALESCE(SUM(s.sp),0) >= 7000  THEN 7000
    WHEN COALESCE(SUM(s.sp),0) >= 3500  THEN 3500
    WHEN COALESCE(SUM(s.sp),0) >= 1500  THEN 1500
    WHEN COALESCE(SUM(s.sp),0) >= 500   THEN 500
    ELSE 0
  END AS sp_nivel_actual,
  CASE
    WHEN COALESCE(SUM(s.sp),0) >= 55000 THEN NULL::INTEGER
    WHEN COALESCE(SUM(s.sp),0) >= 35000 THEN 55000
    WHEN COALESCE(SUM(s.sp),0) >= 22000 THEN 35000
    WHEN COALESCE(SUM(s.sp),0) >= 13000 THEN 22000
    WHEN COALESCE(SUM(s.sp),0) >= 7000  THEN 13000
    WHEN COALESCE(SUM(s.sp),0) >= 3500  THEN 7000
    WHEN COALESCE(SUM(s.sp),0) >= 1500  THEN 3500
    WHEN COALESCE(SUM(s.sp),0) >= 500   THEN 1500
    ELSE 500
  END AS sp_siguiente_nivel
FROM gerentes g
LEFT JOIN sp_acumulados s ON g.id = s.gerente_id
GROUP BY g.id, g.nombre, g.canal, g.pais, g.lider, g.activo, g.avatar_url, g.user_id;

CREATE VIEW ranking_general AS
SELECT
  id,
  nombre,
  canal,
  pais,
  sp_totales,
  nivel,
  avatar_url,
  user_id,
  RANK() OVER (ORDER BY sp_totales DESC) AS posicion,
  RANK() OVER (PARTITION BY canal ORDER BY sp_totales DESC) AS posicion_canal
FROM sp_totales_gerente
WHERE activo = TRUE;

CREATE VIEW racha_activa AS
SELECT DISTINCT ON (gerente_id)
  gerente_id,
  semanas_consecutivas,
  multiplicador,
  estado,
  semana_iso,
  anio,
  CASE
    WHEN semanas_consecutivas >= 12 THEN 'Racha Leyenda'
    WHEN semanas_consecutivas >= 8  THEN 'Racha de Élite'
    WHEN semanas_consecutivas >= 6  THEN 'Racha Dominante'
    WHEN semanas_consecutivas >= 4  THEN 'Racha de Presión'
    WHEN semanas_consecutivas >= 2  THEN 'Racha Encendida'
    ELSE 'Sin Racha'
  END AS nombre_racha
FROM rachas
ORDER BY gerente_id, anio DESC, semana_iso DESC;

CREATE VIEW kpis_mes_actual AS
SELECT
  g.id AS gerente_id,
  g.nombre,
  g.canal,
  g.pais,
  k.anio_mes,
  k.ventas,
  k.meta,
  CASE WHEN k.meta > 0
    THEN ROUND(k.ventas / k.meta * 100, 1)
    ELSE 0
  END AS pct_cumplimiento,
  k.acv_f,
  k.cant_recomendados,
  k.ventas_recomendados,
  CASE WHEN k.cant_recomendados > 0
    THEN ROUND(k.ventas_recomendados::numeric / k.cant_recomendados * 100, 1)
    ELSE 0
  END AS efectividad_referidos_pct,
  k.sc_creados,
  k.ventas_sql,
  CASE WHEN k.sc_creados > 0
    THEN ROUND(k.ventas_sql::numeric / k.sc_creados * 100, 1)
    ELSE 0
  END AS efectividad_sql_pct,
  CASE WHEN k.hc_final > 0
    THEN ROUND(k.ventas / k.hc_final, 0)
    ELSE 0
  END AS productividad_por_asesor,
  k.hc_final,
  k.terminaciones
FROM gerentes g
JOIN kpis_mensuales k ON g.id = k.gerente_id
WHERE k.anio_mes = TO_CHAR(CURRENT_DATE, 'YYYYMM');

CREATE VIEW acv_vc_mensual AS
SELECT
  g.id AS gerente_id,
  g.nombre,
  v.mes,
  v.anio,
  SUM(COALESCE(v.acv_plus, 0)) AS acv_plus_total,
  COUNT(v.documento_factura) AS unidades,
  SUM(COALESCE(v.valor_producto, 0)) AS valor_total,
  SUM(CASE WHEN v.bloque_venta = 'Nomina-e' THEN COALESCE(v.acv_plus,0) ELSE 0 END) AS acv_nomina,
  SUM(CASE WHEN v.bloque_venta = 'FE' THEN COALESCE(v.acv_plus,0) ELSE 0 END) AS acv_fe,
  SUM(CASE WHEN v.bloque_venta = 'Conversiones' THEN COALESCE(v.acv_plus,0) ELSE 0 END) AS acv_conversiones
FROM gerentes g
LEFT JOIN ventas v ON g.id = v.gerente_id AND v.canal = 'VC'
WHERE g.canal = 'VC'
GROUP BY g.id, g.nombre, v.mes, v.anio;

CREATE VIEW feed_reconocimientos AS
SELECT
  r.id,
  r.created_at,
  g_de.nombre AS de_nombre,
  g_para.nombre AS para_nombre,
  g_de.avatar_url AS de_avatar,
  g_para.avatar_url AS para_avatar,
  r.tipo,
  r.sp_para,
  r.sp_de,
  r.mensaje
FROM reconocimientos r
JOIN gerentes g_de ON r.de_gerente_id = g_de.id
JOIN gerentes g_para ON r.para_gerente_id = g_para.id
ORDER BY r.created_at DESC;

-- 11. Create functions
CREATE OR REPLACE FUNCTION calcular_sp_cop(ingresos_cop NUMERIC)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN ingresos_cop >= 500000000 THEN 90 + FLOOR((ingresos_cop - 500000000) / 5000000)::INTEGER
    WHEN ingresos_cop >= 300000000 THEN 50
    WHEN ingresos_cop >= 200000000 THEN 30
    WHEN ingresos_cop >= 150000000 THEN 20
    WHEN ingresos_cop >= 100000000 THEN 12
    WHEN ingresos_cop >= 50000000  THEN 5
    WHEN ingresos_cop >= 10000000  THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calcular_multiplicador(semanas_consecutivas INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE
    WHEN semanas_consecutivas >= 12 THEN 2.0
    WHEN semanas_consecutivas >= 8  THEN 1.75
    WHEN semanas_consecutivas >= 6  THEN 1.5
    WHEN semanas_consecutivas >= 4  THEN 1.25
    WHEN semanas_consecutivas >= 2  THEN 1.1
    ELSE 1.0
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION otorgar_medalla_si_aplica(
  p_gerente_id UUID,
  p_medalla TEXT,
  p_sp INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  ya_tiene BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM medallas
    WHERE gerente_id = p_gerente_id AND medalla = p_medalla
  ) INTO ya_tiene;

  IF NOT ya_tiene THEN
    INSERT INTO medallas (gerente_id, medalla, sp_otorgados)
    VALUES (p_gerente_id, p_medalla, p_sp);

    INSERT INTO sp_acumulados (gerente_id, fuente, sp, periodo, detalle)
    VALUES (p_gerente_id, 'MEDALLA', p_sp,
            TO_CHAR(CURRENT_DATE,'YYYY-MM'), p_medalla);
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 12. Auth trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO gerentes (user_id, email, nombre, avatar_url, canal, pais)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NULL,
    'VC',
    'MEX'
  );
  RETURN NEW;
END;
$$;

-- 13. Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
