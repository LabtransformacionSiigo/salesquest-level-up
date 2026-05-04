import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { buildVnConventionMonthlyRows, sumVnConventionMonthlyRows } from '@/lib/vn-convention';
import { getNivelData } from '@/lib/niveles';
import { setSpConvencionAnual } from '@/lib/sp-convencion-store';

export interface Gerente {
  id: string;
  user_id: string;
  gerente_id?: string | null;
  nombre: string;
  email: string;
  canal: string | null;
  pais: string | null;
  lider: string | null;
  celula: string | null;
  activo: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthUser extends Gerente {
  sp_totales: number;
  nivel: string;
  sp_nivel_actual: number;
  sp_siguiente_nivel: number | null;
  role: string | null;
  sp_canje: number;
  sp_convencion: number;
  sp_periodo_actual?: number;
  canal_direccion?: string | null;
}


const MONTH_NUMBERS_ES: Record<string, string> = {
  Enero: '01',
  Febrero: '02',
  Marzo: '03',
  Abril: '04',
  Mayo: '05',
  Junio: '06',
  Julio: '07',
  Agosto: '08',
  Septiembre: '09',
  Octubre: '10',
  Noviembre: '11',
  Diciembre: '12',
};


const getCurrentConventionYear = () => new Date().getFullYear();

const sumConventionRows = (rows: Array<{ sp?: number | null }> | null | undefined) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);

const getVcMonthlyConventionTotal = (rows: Array<{ anio?: number | null; mes?: string | null; acv_plus?: number | null; meta?: number | null }> | null | undefined) => {
  const monthly = new Map<string, { acv: number; meta: number }>();

  (rows || []).forEach((row) => {
    const year = Number(row.anio) || 0;
    const month = row.mes ? MONTH_NUMBERS_ES[row.mes] : null;
    if (!year || !month) return;

    const period = `${year}${month}`;
    const current = monthly.get(period) || { acv: 0, meta: 0 };
    current.acv += Number(row.acv_plus) || 0;
    current.meta += Number(row.meta) || 0;
    monthly.set(period, current);
  });

  return [...monthly.values()].reduce((total, row) => {
    if (row.meta <= 0 || row.acv <= 0) return total;
    return total + Math.round((row.acv / row.meta) * 100);
  }, 0);
};

const META_ACV_SCALE_BY_COUNTRY: Record<string, number> = {
  COL: 1_000_000,
  MEX: 1_000,
  ECU: 100,
  URU: 100,
};

const resolveCountryCode = (pais?: string | null): string | null => {
  if (!pais) return null;
  const normalized = String(pais).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'MX' || normalized.startsWith('MEX')) return 'MEX';
  if (normalized === 'CO' || normalized.startsWith('COL')) return 'COL';
  if (normalized === 'EC' || normalized.startsWith('ECU')) return 'ECU';
  if (normalized === 'UY' || normalized.startsWith('URU')) return 'URU';
  return normalized;
};

const normalizeVnMetaAcv = (value: number | null | undefined, pais?: string | null) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  const abs = Math.abs(n);
  if (abs >= 100_000) return Math.round(n);
  const country = resolveCountryCode(pais);
  const factor = (country && META_ACV_SCALE_BY_COUNTRY[country]) || 1_000_000;
  return Math.round(n * factor);
};

const normalizeStoredAcv = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

const getVnMonthlyConventionTotal = (rows: Array<{ anio_mes?: string | null; acv_f?: number | null; meta?: number | null; pais?: string | null }> | null | undefined) => {
  const monthly = new Map<string, { acv: number; meta: number }>();

  (rows || []).forEach((row) => {
    const period = String(row.anio_mes || '');
    if (!period) return;

    const acv = normalizeStoredAcv(row.acv_f);
    const current = monthly.get(period) || { acv: 0, meta: 0 };
    current.acv += acv;
    current.meta += normalizeVnMetaAcv(row.meta, row.pais);
    monthly.set(period, current);
  });

  return [...monthly.values()].reduce((total, row) => {
    if (row.meta <= 0 || row.acv <= 0) return total;
    return total + Math.round((row.acv / row.meta) * 100);
  }, 0);
};

/**
 * Calcula SP Convención VN incluyendo FE (1%=1SP) y Nube (1%=2SP)
 * usando ejecucion_asesores y metas_asesores agrupados por periodo
 */
const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getVnFeNubeConventionTotal = (
  ejecRows: Array<{ periodo?: string; documento_asesor?: string; ventas_fe?: number; ventas_nube?: number }> | null | undefined,
  metaRows: Array<{ anio_mes?: string; documento_asesor?: string; meta_fe?: number; meta_nube?: number; novedad?: string }> | null | undefined,
) => {
  // Aggregate metas by period (excluding novedades)
  const metaByPeriod = new Map<string, { fe: number; nube: number }>();
  (metaRows || []).forEach((m) => {
    const nov = (m.novedad ?? '').toString().trim();
    if (nov !== '' && nov !== 'Sin novedad') return;
    const period = String(m.anio_mes || '');
    if (!period) return;
    const cur = metaByPeriod.get(period) || { fe: 0, nube: 0 };
    cur.fe += Number(m.meta_fe) || 0;
    cur.nube += Number(m.meta_nube) || 0;
    metaByPeriod.set(period, cur);
  });

  // Aggregate ejecucion by period
  const ejecByPeriod = new Map<string, { fe: number; nube: number }>();
  (ejecRows || []).forEach((e) => {
    const period = String(e.periodo || '');
    if (!period) return;
    const cur = ejecByPeriod.get(period) || { fe: 0, nube: 0 };
    cur.fe += Number(e.ventas_fe) || 0;
    cur.nube += Number(e.ventas_nube) || 0;
    ejecByPeriod.set(period, cur);
  });

  const CAP = 300;
  let totalSp = 0;
  metaByPeriod.forEach((meta, period) => {
    const ejec = ejecByPeriod.get(period);
    if (!ejec) return;
    // FE: 1% = 1 SP (cap 300)
    if (meta.fe > 0 && ejec.fe > 0) {
      let pctFe = Math.round((ejec.fe / meta.fe) * 100);
      if (pctFe > CAP) pctFe = CAP;
      totalSp += pctFe;
    }
    // Nube: 1% = 2 SP (cap 300 antes de ×2)
    if (meta.nube > 0 && ejec.nube > 0) {
      let pctNube = Math.round((ejec.nube / meta.nube) * 100);
      if (pctNube > CAP) pctNube = CAP;
      totalSp += pctNube * 2;
    }
  });

  return totalSp;
};

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserProfile(session.user.id, session.user.email ?? null), 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email ?? null);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, authEmail?: string | null) => {
    try {
      const currentConventionYear = getCurrentConventionYear();
      const currentConventionPeriod = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const roleRes = await supabase.from('user_roles').select('role').eq('user_id', userId);
      const roles = (roleRes.data || []).map((r: any) => r.role);
      const userRole = roles.includes('admin')
        ? 'admin'
        : roles.includes('especialista')
          ? 'especialista'
          : roles.includes('gerente')
            ? 'gerente'
            : roles[0] ?? 'gerente';

      // Admins y Especialistas no compiten — perfil simplificado
      if (userRole === 'admin' || userRole === 'especialista') {
        const { data: gerenteData } = await supabase
          .from('gerentes')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        setProfile({
          id: gerenteData?.id || userId,
          user_id: userId,
          gerente_id: null,
          nombre: gerenteData?.nombre || (userRole === 'especialista' ? 'Especialista' : 'Administrador'),
          email: gerenteData?.email || '',
          canal: gerenteData?.canal || null,
          pais: gerenteData?.pais || null,
          lider: null,
          celula: null,
          activo: true,
          avatar_url: gerenteData?.avatar_url || null,
          created_at: gerenteData?.created_at || '',
          sp_totales: 0,
          nivel: userRole === 'especialista' ? 'Especialista' : 'Admin',
          sp_nivel_actual: 0,
          sp_siguiente_nivel: null,
          role: userRole,
           sp_canje: 0,
           sp_convencion: 0,
        });
        setLoading(false);
        return;
      }

      if (userRole === 'asesor') {
        const asesorRes = await supabase
          .from('asesores')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (asesorRes.error) throw asesorRes.error;

        if (asesorRes.data) {
          const asesor = asesorRes.data;
          const isVnAdvisor = asesor.canal === 'VN_ALIADOS' || asesor.canal === 'VN_EMPRESARIOS';

          // VN debe reflejar el total persistido en backend; VC sigue calculando dinámicamente
          let spTotales = isVnAdvisor ? Number(asesor.sp_convencion) || 0 : 0;
          let spPeriodoActual = 0;

          if (asesor.canal === 'VC') {
            const vcRes = await supabase
              .from('ventas')
              .select('anio, mes, acv_plus, meta')
              .eq('canal', 'VC')
              .eq('anio', currentConventionYear)
              .eq('gerente_id', asesor.gerente_id)
              .eq('comercial', asesor.nombre)
              .like('documento_factura', 'SUM-%');
            if (!vcRes.error) {
              spTotales = getVcMonthlyConventionTotal(vcRes.data as any[]);
            }
          } else {
            // VN asesor: ACV SP
            let vnQuery = supabase
              .from('productividad_asesores')
              .select('anio_mes, asesor, acv_f, meta, pais')
              .eq('asesor', asesor.nombre)
              .gte('anio_mes', `${currentConventionYear}01`)
              .lte('anio_mes', `${currentConventionYear}12`);
            if (asesor.pais) vnQuery = vnQuery.eq('pais', asesor.pais);

            const ejecQuery = supabase
              .from('ejecucion_asesores')
              .select('periodo, documento_asesor, ventas_fe, ventas_nube')
              .gte('periodo', `${currentConventionYear}01`)
              .lte('periodo', `${currentConventionYear}12`)
              .limit(20000);

            const metasQuery = supabase
              .from('metas_asesores')
              .select('anio_mes, nombre_asesor, documento_asesor, meta_fe, meta_nube, meta_total, novedad')
              .gte('anio_mes', `${currentConventionYear}01`)
              .lte('anio_mes', `${currentConventionYear}12`)
              .limit(5000);

            const [vnRes, ejecRes, metasRes] = await Promise.all([vnQuery, ejecQuery, metasQuery]);
            if (!vnRes.error && !ejecRes.error && !metasRes.error) {
              const advisorName = normalizeComparableText(asesor.nombre);
              const monthlyRows = buildVnConventionMonthlyRows({
                productivityRows: (vnRes.data as any[]).filter((row) => normalizeComparableText((row as any).asesor) === advisorName),
                metaRows: (metasRes.data as any[]).filter((row) => normalizeComparableText((row as any).nombre_asesor) === advisorName),
                ejecRows: ejecRes.data as any[],
              });
              if (!isVnAdvisor || spTotales === 0) {
                spTotales = sumVnConventionMonthlyRows(monthlyRows);
              }
              spPeriodoActual = monthlyRows.find((row) => row.period === currentConventionPeriod)?.sp || 0;
            } else if (!vnRes.error && (!isVnAdvisor || spTotales === 0)) {
              spTotales = getVnMonthlyConventionTotal(vnRes.data as any[]);
            }
          }

          // Fallback a sp_acumulados solo si el cálculo dinámico da 0
          if (spTotales === 0) {
            const spRes = await supabase
              .from('sp_acumulados')
              .select('sp')
              .eq('gerente_id', asesor.id)
              .eq('fuente', 'CUMPLIMIENTO_META')
              .eq('tipo_sp', 'convencion')
              .gte('periodo', `${currentConventionYear}01`)
              .lte('periodo', `${currentConventionYear}12`);
            if (!spRes.error) {
              spTotales = sumConventionRows(spRes.data);
            }
          }

          const nivelData = getNivelData(spTotales, asesor.canal);
          // Seed global SP Convención store as baseline; useSpConvencionAnualSelf
          // will overwrite with the canonical value once Sidebar mounts.
          if (spTotales > 0) setSpConvencionAnual(spTotales);

          setProfile({
            id: asesor.id,
            user_id: asesor.user_id ?? userId,
            gerente_id: asesor.gerente_id,
            nombre: asesor.nombre,
            email: asesor.email,
            canal: asesor.canal,
            pais: asesor.pais,
            lider: null,
            celula: null,
            activo: asesor.activo ?? true,
            avatar_url: asesor.avatar_url,
            created_at: asesor.created_at ?? '',
            sp_totales: spTotales,
            nivel: nivelData.nivel,
            sp_nivel_actual: nivelData.sp_nivel_actual,
            sp_siguiente_nivel: nivelData.sp_siguiente_nivel,
            role: 'asesor',
             sp_canje: asesor.sp_canje ?? 0,
             sp_convencion: spTotales,
             sp_periodo_actual: spPeriodoActual,
            canal_direccion: (asesor as any).canal_direccion ?? null,
          });
        } else {
          setProfile(null);
        }
      } else {
        const emailNorm = String(authEmail || '').trim().toLowerCase();
        const gerenteSelect = 'id, user_id, sp_canje, sp_convencion, celula, canal, nombre, email, pais, lider, activo, avatar_url, created_at';
        const gerenteQuery = emailNorm
          ? supabase.from('gerentes').select(gerenteSelect).or(`user_id.eq.${userId},email.ilike.${emailNorm}`).limit(25)
          : supabase.from('gerentes').select(gerenteSelect).eq('user_id', userId).limit(25);

        const [profileTotalsRes, gerenteListRes] = await Promise.all([
          supabase.from('sp_totales_gerente').select('*').eq('user_id', userId).limit(25),
          gerenteQuery,
        ]);

        const scoreGerente = (g: any) => {
          const email = String(g?.email || '').trim().toLowerCase();
          const emailPrefix = email.split('@')[0] || '';
          const nombreNorm = normalizeComparableText(g?.nombre).replace(/[._-]/g, ' ');
          const prefixNorm = normalizeComparableText(emailPrefix).replace(/[._-]/g, ' ');
          let score = 0;
          if (g?.user_id === userId) score += 100;
          if (emailNorm && email === emailNorm) score += 90;
          if (g?.activo !== false) score += 25;
          if (g?.celula) score += 50;
          if (g?.canal === 'VN_ALIADOS' || g?.canal === 'VN_EMPRESARIOS') score += 15;
          if (nombreNorm && nombreNorm !== prefixNorm) score += 10;
          return score;
        };

        const gerenteCandidates = ((gerenteListRes.data as any[]) || []).sort((a, b) => scoreGerente(b) - scoreGerente(a));
        const gerenteRes = { data: gerenteCandidates[0] || null, error: gerenteListRes.error } as any;

        // Si no hay fila en la vista sp_totales_gerente, usamos un fallback desde la tabla gerentes
        // para que el gerente pueda iniciar sesión aunque no tenga ventas/metas registradas todavía.
        const totalsRows = (profileTotalsRes.data as any[]) || [];
        let data: any = gerenteRes.data
          ? { ...gerenteRes.data, ...(totalsRows.find((row) => row.id === gerenteRes.data.id) || {}) }
          : totalsRows[0];
        if (!data && (gerenteRes.data as any)?.id) {
          const g: any = gerenteRes.data;
          data = {
            id: g.id,
            user_id: userId,
            nombre: g.nombre ?? null,
            email: g.email ?? null,
            canal: g.canal ?? null,
            pais: g.pais ?? null,
            lider: g.lider ?? null,
            celula: g.celula ?? null,
            activo: g.activo ?? true,
            avatar_url: g.avatar_url ?? null,
            created_at: g.created_at ?? null,
            sp_convencion: g.sp_convencion ?? 0,
            sp_canje: g.sp_canje ?? 0,
          };
        }

        if (data) {
          const gerenteId = data.id || (gerenteRes.data as any)?.id;
          const gerenteCelula = (gerenteRes.data as any)?.celula;
          const gerenteCanal = (gerenteRes.data as any)?.canal || data.canal;
          const isVnGerente = gerenteCanal === 'VN_ALIADOS' || gerenteCanal === 'VN_EMPRESARIOS';

          let spTotales = isVnGerente ? Number((gerenteRes.data as any)?.sp_convencion) || 0 : 0;
          let spPeriodoActual = 0;

          if (isVnGerente && gerenteCelula) {
            // VN: traemos productividad y metas SIN filtrar por celula en SQL,
            // porque productividad usa "Equipo México X" (con tilde) y metas usa
            // "Equipo Mexico X" (sin tilde). Filtramos en cliente con normalizeComparableText.
            const normalizedCelula = normalizeComparableText(gerenteCelula);
            const canalDireccion = gerenteCanal === 'VN_ALIADOS' ? 'Aliados' : 'Empresarios';
            const [vnRes, metasVnRes, ventasDiariasRes, acvCatalogRes] = await Promise.all([
              supabase
                .from('productividad_asesores')
                .select('anio_mes, asesor, acv_f, meta, celula, pais')
                .gte('anio_mes', `${currentConventionYear}01`)
                .lte('anio_mes', `${currentConventionYear}12`)
                .limit(20000),
              supabase
                .from('metas_asesores')
                .select('anio_mes, documento_asesor, nombre_asesor, meta_fe, meta_nube, novedad, celula, gerente, canal_direccion, pais')
                .gte('anio_mes', `${currentConventionYear}01`)
                .lte('anio_mes', `${currentConventionYear}12`)
                .limit(20000),
              supabase
                .from('ventas_diarias')
                .select('fecha, asesor, celula, producto, pais, tipo_producto, unidades, canal_direccion')
                .gte('fecha', `${currentConventionYear}-01-01`)
                .lt('fecha', `${currentConventionYear + 1}-01-01`)
                .eq('canal_direccion', canalDireccion)
                .limit(50000),
              // Catálogo oficial de metas ACV (Databricks → metas_acv_gerentes)
              supabase
                .from('metas_acv_gerentes' as any)
                .select('pais, canal, celula, mes, meta_total_acv, meta_total_und, archivo'),
            ]);
            const acvCatalogRows = (acvCatalogRes?.data as any[]) || [];
            if (!vnRes.error && !metasVnRes.error) {
              const productivityRows = ((vnRes.data as any[]) || []).filter(
                (row) => normalizeComparableText(row.celula) === normalizedCelula,
              );
              const metaRowsFiltered = ((metasVnRes.data as any[]) || []).filter(
                (row) => normalizeComparableText(row.celula) === normalizedCelula,
              );

              // SOURCE OF TRUTH: ventas_diarias aggregated by celula+period.
              // Build a synthetic ejecRows shape that buildVnConventionMonthlyRows can consume.
              const ventasByPeriod = new Map<string, { fe: number; nube: number; total: number }>();
              ((ventasDiariasRes?.data as any[]) || [])
                .filter((row) => normalizeComparableText(row.celula) === normalizedCelula)
                .forEach((row) => {
                  const fecha = String(row.fecha || '');
                  if (fecha.length < 7) return;
                  const period = fecha.slice(0, 7).replace('-', '');
                  const cur = ventasByPeriod.get(period) || { fe: 0, nube: 0, total: 0 };
                  const u = Number(row.unidades) || 0;
                  const producto = String(row.producto || '');
                  const tipoBase = String(row.tipo_producto || '').toUpperCase();
                  const tipo = producto || tipoBase;
                  cur.total += u;
                  if (String(tipo).includes('FE')) cur.fe += u;
                  else if (String(tipo).includes('NUBE')) cur.nube += u;
                  ventasByPeriod.set(period, cur);
                });

              const syntheticEjec = [...ventasByPeriod.entries()].map(([period, v]) => ({
                periodo: period,
                documento_asesor: `__celula_${normalizedCelula}`,
                ventas_fe: v.fe,
                ventas_nube: v.nube,
                ventas_total: v.total,
              }));

              // Inject the synthetic identifier into metas so the period-level matcher accepts it
              const metaRowsWithSynthetic = metaRowsFiltered.length > 0
                ? [
                    ...metaRowsFiltered,
                    ...[...ventasByPeriod.keys()].map((period) => ({
                      anio_mes: period,
                      nombre_asesor: `__celula_${normalizedCelula}`,
                      novedad: 'Sin novedad',
                      meta_fe: 0,
                      meta_nube: 0,
                      meta_total: 0,
                    })),
                  ]
                : metaRowsFiltered;

                if (syntheticEjec.length > 0) {
                const monthlyRows = buildVnConventionMonthlyRows({
                  productivityRows,
                  metaRows: metaRowsWithSynthetic,
                  ejecRows: syntheticEjec,
                  acvCatalog: acvCatalogRows,
                  celula: gerenteCelula,
                });
                  if (!spTotales) {
                    spTotales = sumVnConventionMonthlyRows(monthlyRows);
                  }
                spPeriodoActual = monthlyRows.find((row) => row.period === currentConventionPeriod)?.sp || 0;
              } else {
                // Fallback to ejecucion_asesores if no ventas_diarias yet
                const { data: ejecVnRows, error: ejecVnError } = await supabase
                  .from('ejecucion_asesores')
                  .select('periodo, documento_asesor, ventas_fe, ventas_nube, ventas_total')
                  .gte('periodo', `${currentConventionYear}01`)
                  .lte('periodo', `${currentConventionYear}12`)
                  .limit(20000);

                  if (!ejecVnError) {
                  const monthlyRows = buildVnConventionMonthlyRows({
                    productivityRows,
                    metaRows: metaRowsFiltered,
                    ejecRows: ejecVnRows as any[],
                    acvCatalog: acvCatalogRows,
                    celula: gerenteCelula,
                  });
                    if (!spTotales) {
                      spTotales = sumVnConventionMonthlyRows(monthlyRows);
                    }
                    spPeriodoActual = monthlyRows.find((row) => row.period === currentConventionPeriod)?.sp || 0;
                } else {
                  spTotales = getVnMonthlyConventionTotal(productivityRows);
                }
              }
            } else if (!vnRes.error) {
              const productivityRows = ((vnRes.data as any[]) || []).filter(
                (row) => normalizeComparableText(row.celula) === normalizedCelula,
              );
              spTotales = getVnMonthlyConventionTotal(productivityRows);
            }
          } else if (gerenteId) {
            // VC: calcular desde ventas SUM-
            const vcRes = await supabase
              .from('ventas')
              .select('anio, mes, acv_plus, meta')
              .eq('canal', 'VC')
              .eq('anio', currentConventionYear)
              .eq('gerente_id', gerenteId)
              .like('documento_factura', 'SUM-%');
            if (!vcRes.error) {
              spTotales = getVcMonthlyConventionTotal(vcRes.data as any[]);
            }
          }

          // Fallback a sp_acumulados solo si el cálculo dinámico da 0
          if (spTotales === 0 && gerenteId) {
            const spRes = await supabase
              .from('sp_acumulados')
              .select('sp')
              .eq('gerente_id', gerenteId)
              .eq('fuente', 'CUMPLIMIENTO_META')
              .eq('tipo_sp', 'convencion')
              .gte('periodo', `${currentConventionYear}01`)
              .lte('periodo', `${currentConventionYear}12`);
            if (!spRes.error) {
              spTotales = sumConventionRows(spRes.data as any[]);
            }
          }

          const nivelData = getNivelData(spTotales, gerenteCanal);

          setProfile({
            id: data.id,
            user_id: data.user_id ?? userId,
            gerente_id: null,
            nombre: data.nombre,
            email: data.email ?? authEmail ?? '',
            canal: gerenteCanal,
            pais: data.pais,
            lider: data.lider,
            celula: gerenteCelula ?? null,
            activo: data.activo ?? true,
            avatar_url: data.avatar_url,
            created_at: data.created_at ?? '',
            sp_totales: spTotales,
            nivel: nivelData.nivel,
            sp_nivel_actual: nivelData.sp_nivel_actual,
            sp_siguiente_nivel: nivelData.sp_siguiente_nivel,
            role: userRole,
             sp_canje: (gerenteRes.data as any)?.sp_canje ?? 0,
              sp_convencion: spTotales,
             sp_periodo_actual: spPeriodoActual,
          });
        } else {
          setProfile(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error };
    }
    return { data, error: null };
  };

  const signUp = async (email: string, password: string, metadata?: { name?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    // Intentar cerrar sesión global; si falla (token inválido/expirado), forzar limpieza local
    let error: any = null;
    try {
      const result = await supabase.auth.signOut();
      error = result.error;
      // Si el servidor dice "session_not_found", igual limpiamos local
      if (error && (error.status === 403 || error.message?.toLowerCase().includes('session'))) {
        await supabase.auth.signOut({ scope: 'local' });
        error = null;
      }
    } catch (e) {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    }
    // Limpieza defensiva del storage por si quedaron tokens huérfanos
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.includes('-auth-token'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    setProfile(null);
    setUser(null);
    setSession(null);
    return { error };
  };

  const updateProfile = async (updates: Partial<Gerente>) => {
    if (!user || !profile) return { error: new Error('No user logged in') };
    const { data, error } = await supabase
      .from('gerentes')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();
    if (!error && data) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    return { data, error };
  };

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated: !!session && !!profile,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile: () => user && fetchUserProfile(user.id, user.email ?? null),
  };
};
