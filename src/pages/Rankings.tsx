import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, podiumBounce } from '@/lib/animations';
import { normalizePersonName } from '@/lib/vc-advisor-metrics';
import { buildVnConventionMonthlyRows, normalizeStoredAcv, normalizeVnMetaAcv } from '@/lib/vn-convention';
import { computeSpConvencionAnualForCelula, computeSpConvencionAnualForAsesor } from '@/lib/sp-convencion-anual';
import colombiaFlag from '@/assets/flags/colombia.svg';
import mexicoFlag from '@/assets/flags/mexico.svg';
import ecuadorFlag from '@/assets/flags/ecuador.svg';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const FLAG_IMG: Record<string, string> = { COL: colombiaFlag, CO: colombiaFlag, MEX: mexicoFlag, MX: mexicoFlag, ECU: ecuadorFlag, EC: ecuadorFlag };
const CANALES_LABEL: Record<string, string> = { VN_EMPRESARIOS: 'Empresarios', VN_ALIADOS: 'Aliados', VC: 'Venta Cruzada' };
const REFERIDOS_LABEL: Record<string, string> = { VN_ALIADOS: 'Ref. Contador', VN_EMPRESARIOS: 'Referidos' };
const PAIS_LABEL: Record<string, string> = { COL: 'Colombia', MEX: 'México', ECU: 'Ecuador' };
const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['border-yellow bg-siigo-yellow/5', 'border-muted-foreground/30', 'border-orange/40'];
type RankingTab = 'comerciales' | 'gerentes';

const FlagIcon = ({ pais }: { pais?: string | null }) => {
  const src = FLAG_IMG[pais?.trim().toUpperCase() || ''];
  return src ? <img src={src} alt={pais || ''} className="h-4 w-4 rounded-full object-cover" /> : <span className="text-base">🌎</span>;
};

const formatMoney = (val: number | null | undefined) => {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getCurrentConventionYear = () => new Date().getFullYear();

const sumMonthlyConvention = <T extends { sp?: number | null }>(rows: T[]) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<RankingTab>('comerciales');
  const isVC = profile?.canal === 'VC';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const userPais = profile?.pais || 'COL';

  const fetchRanking = async () => {
    if (!profile?.canal) return;
    setDataLoading(true);
    const currentConventionYear = getCurrentConventionYear();

    if (isVC) {
      if (tab === 'comerciales') {
        const [comRes, gerentesRes, asesoresRes, ventasRes] = await Promise.all([
          supabase.from('ranking_vc_comerciales' as any).select('*'),
          supabase.from('gerentes').select('nombre, pais').eq('canal', 'VC'),
          supabase.from('asesores').select('nombre, sp_canje').eq('canal', 'VC'),
          supabase.from('ventas').select('comercial, anio, mes, acv_plus, meta').eq('canal', 'VC').eq('anio', currentConventionYear).like('documento_factura', 'SUM-%').range(0, 5000),
        ]);
        const gerentePaisMap = new Map<string, string>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.nombre) gerentePaisMap.set(g.nombre, g.pais || 'COL');
        });
        const monthlyByComercial = new Map<string, Map<string, { acv: number; meta: number }>>();
        (ventasRes.data || []).forEach((row: any) => {
          const comercial = normalizePersonName(row.comercial);
          const monthNumber = ({ Enero: '01', Febrero: '02', Marzo: '03', Abril: '04', Mayo: '05', Junio: '06', Julio: '07', Agosto: '08', Septiembre: '09', Octubre: '10', Noviembre: '11', Diciembre: '12' } as Record<string, string>)[row.mes || ''];
          if (!comercial || !row.anio || !monthNumber) return;

          const period = `${row.anio}${monthNumber}`;
          const monthly = monthlyByComercial.get(comercial) || new Map<string, { acv: number; meta: number }>();
          const current = monthly.get(period) || { acv: 0, meta: 0 };
          current.acv += Number(row.acv_plus) || 0;
          current.meta += Number(row.meta) || 0;
          monthly.set(period, current);
          monthlyByComercial.set(comercial, monthly);
        });
        const spByComercial = new Map<string, number>();
        monthlyByComercial.forEach((months, comercial) => {
          const rows = [...months.values()].map((month) => ({ sp: month.meta > 0 && month.acv > 0 ? Math.round((month.acv / month.meta) * 100) : 0 }));
          spByComercial.set(comercial, sumMonthlyConvention(rows));
        });
        const canjeablesByComercial = new Map<string, number>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) canjeablesByComercial.set(normalizePersonName(a.nombre), Number(a.sp_canje) || 0);
        });
        const currentName = normalizePersonName(profile?.nombre);
        const mapped = (comRes.data || []).map((r: any) => ({
          id: `${r.nombre}-${r.gerente_nombre}`,
          nombre: r.nombre,
          gerente_nombre: r.gerente_nombre,
          kpi_value: Math.round(Number(r.acv_total) || 0),
          meta_total: Math.round(Number(r.meta_total) || 0),
          sp_totales: spByComercial.get(normalizePersonName(r.nombre)) || 0,
          pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
          ventas_count: r.ventas_count,
          posicion: r.posicion,
          canal: 'VC',
          pais: gerentePaisMap.get(r.gerente_nombre) || 'COL',
          sp_canje: canjeablesByComercial.get(normalizePersonName(r.nombre)) || 0,
          nivel: null,
          isCurrent: profile?.role === 'asesor' && normalizePersonName(r.nombre) === currentName,
        }));
        // Filter by user's country
        setRanking(mapped.filter(r => r.pais === userPais));
      } else {
        // Gerentes VC — filter by user's country
        const [vcGerentesRes, spRes, gerentesRes] = await Promise.all([
          supabase.from('ranking_vc_gerentes' as any).select('*').eq('pais', userPais),
          supabase.from('ranking_general').select('id, sp_totales, nivel, user_id, avatar_url').eq('canal', 'VC'),
          supabase.from('gerentes').select('id, sp_canje').eq('canal', 'VC').eq('pais', userPais),
        ]);
        const spMap = new Map<string, any>();
        (spRes.data || []).forEach((s: any) => {
          if (s.id) spMap.set(s.id, s);
        });
        const canjeablesMap = new Map<string, number>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.id) canjeablesMap.set(g.id, Number(g.sp_canje) || 0);
        });
        const mapped = (vcGerentesRes.data || []).map((r: any) => {
          const sp = spMap.get(r.gerente_id);
          return {
            id: r.gerente_id,
            nombre: r.nombre,
            pais: r.pais,
            canal: 'VC',
            kpi_value: Math.round(Number(r.acv_total) || 0),
            meta_total: Math.round(Number(r.meta_total) || 0),
            pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
            sp_totales: sp?.sp_totales || 0,
            sp_canje: canjeablesMap.get(r.gerente_id) || 0,
            nivel: sp?.nivel || null,
            user_id: sp?.user_id || null,
            avatar_url: sp?.avatar_url || null,
            posicion: r.posicion,
          };
        });
        setRanking(mapped);
      }
    } else if (isVN) {
      // VN channels
      const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
      if (tab === 'comerciales') {
        // Build ranking directly from productividad_asesores
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [productividadRes, asesoresRes, metasAsesoresRes, ejecAsesoresRes, vgmRes, metasAcvRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, anio_mes, ventas, meta, cant_recomendados, pais, celula, acv_f').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).range(0, 5000),
          supabase.from('asesores').select('id, nombre, sp_canje, sp_convencion, pais').eq('canal', profile.canal).eq('pais', userPais),
          supabase.from('metas_asesores').select('anio_mes, nombre_asesor, documento_asesor, novedad, meta_total, meta_fe, meta_nube, celula, gerente').gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).range(0, 20000),
          supabase.from('ejecucion_asesores').select('periodo, documento_asesor, ventas_fe, ventas_nube, ventas_total').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(20000),
          supabase.from('ventas_gerente_mensual').select('periodo, familia, unidades, acv, celula, gerente_normalizado').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(10000),
          supabase.from('metas_acv_gerentes').select('celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo').limit(2000),
        ]);
        // Build set of asesor names WITH novedad
        const asesoresConNovedad = new Set<string>();
        (metasAsesoresRes.data || []).forEach((r: any) => {
          const nov = r.novedad ? String(r.novedad).trim().toLowerCase() : '';
          if (nov && nov !== 'sin novedad' && r.nombre_asesor) {
            asesoresConNovedad.add(String(r.nombre_asesor).trim().toLowerCase());
          }
        });
        const asesorInfoMap = new Map<string, { id?: string; sp_canje: number; sp_convencion: number }>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) {
            asesorInfoMap.set(normalizePersonName(a.nombre), {
              id: a.id,
              sp_canje: Number(a.sp_canje) || 0,
              sp_convencion: Number(a.sp_convencion) || 0,
            });
          }
        });
        // Aggregate by advisor
        const advisorAgg = new Map<string, { ventas: number; meta: number; recomendados: number; unidades: number; acv: number; currentAcv: number; celula: string; months: Map<string, { ventas: number; meta: number; acv: number }> }>();
        (productividadRes.data || []).forEach((row: any) => {
          const name = row.asesor;
          if (!name) return;
          const key = normalizePersonName(name);
          const agg = advisorAgg.get(key) || { ventas: 0, meta: 0, recomendados: 0, unidades: 0, acv: 0, currentAcv: 0, celula: '', months: new Map() };
          agg.celula = row.celula || agg.celula;
          // Monthly aggregation for SP calculation
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0, acv: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += normalizeVnMetaAcv(row.meta);
          cm.acv += normalizeStoredAcv(row.acv_f);
          agg.months.set(period, cm);
          // Current month totals
          if (period === currentMonth) {
            agg.ventas += Number(row.ventas) || 0;
            agg.meta += normalizeVnMetaAcv(row.meta);
            agg.recomendados += Number(row.cant_recomendados) || 0;
            agg.currentAcv += normalizeStoredAcv(row.acv_f);
          }
          // Totals across all months
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += normalizeStoredAcv(row.acv_f);
          advisorAgg.set(key, agg);
          // Keep original name
          if (!agg.celula) agg.celula = row.celula || '';
        });
        // Build ranking entries
        const entries: any[] = [];
        const spAsesorInputs = {
          metaAsesorRows: metasAsesoresRes.data || [],
          ejecAsesorRows: ejecAsesoresRes.data || [],
          productividadRows: productividadRes.data || [],
          year: String(currentConventionYear),
        };
        advisorAgg.forEach((agg, key) => {
          const monthlyRows = buildVnConventionMonthlyRows({
            productivityRows: (productividadRes.data || []).filter((row: any) => normalizePersonName(row.asesor) === key),
            metaRows: (metasAsesoresRes.data || []).filter((row: any) => normalizePersonName(row.nombre_asesor) === key),
            ejecRows: ejecAsesoresRes.data || [],
          });
          const currentMonthly = monthlyRows.find((row) => row.period === currentMonth);
          const asesorInfo = asesorInfoMap.get(key);
          const currentAcv = agg.currentAcv;
          const currentMetaAcv = agg.meta;
          const pct = currentMonthly?.pctAcv ?? (currentMetaAcv > 0 && currentAcv > 0 ? Math.round((currentAcv / currentMetaAcv) * 100) : 0);
          // SP Convención = suma ANUAL de SP por mes del ASESOR individual (fórmula única).
          const originalName = (productividadRes.data || []).find((r: any) => normalizePersonName(r.asesor) === key)?.asesor || key;
          const spFinal = computeSpConvencionAnualForAsesor(spAsesorInputs, originalName);
          entries.push({
            id: asesorInfo?.id || key,
            nombre: originalName,
            gerente_nombre: agg.celula,
            kpi_value: Math.round(currentAcv || agg.acv),
            meta_acv: currentMetaAcv,
            meta_unidades: currentMonthly?.metaTotal || 0,
            unidades_logradas: agg.ventas,
            unidades_total: agg.unidades,
            cant_recomendados: agg.recomendados,
            pct_cumplimiento: pct,
            pct_fe: currentMonthly?.pctFe || 0,
            pct_nube: currentMonthly?.pctNube || 0,
            ventas_count: agg.ventas,
            posicion: 0,
            canal: profile.canal,
            pais: userPais,
            sp_totales: spFinal,
            sp_canje: asesorInfo?.sp_canje || 0,
            nivel: null,
          });
        });
        setRanking(entries);
      } else {
        // Gerentes tab for VN: aggregate productividad_asesores by celula (team)
        const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [productividadRes, gerentesRes, rolesRes, metasAsesoresRes, ejecAsesoresGerenteRes, vgmGerRes, metasAcvGerRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, celula, anio_mes, ventas, meta, cant_recomendados, acv_f, pais').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).range(0, 5000),
          supabase.from('gerentes').select('id, nombre, celula, sp_canje, sp_convencion, user_id').eq('canal', profile.canal).eq('pais', userPais),
          supabase.from('user_roles').select('user_id, role'),
          supabase.from('metas_asesores').select('anio_mes, nombre_asesor, documento_asesor, novedad, meta_total, meta_fe, meta_nube, celula, gerente').gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).range(0, 20000),
          supabase.from('ejecucion_asesores').select('periodo, documento_asesor, ventas_fe, ventas_nube, ventas_total, canal_direccion').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(20000),
          supabase.from('ventas_gerente_mensual').select('periodo, familia, unidades, acv, celula, gerente_normalizado').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(10000),
          supabase.from('metas_acv_gerentes').select('celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo').limit(2000),
        ]);
        // Build set of asesor names WITH novedad
        const asesoresConNovedadTeam = new Set<string>();
        (metasAsesoresRes.data || []).forEach((r: any) => {
          const nov = r.novedad ? String(r.novedad).trim().toLowerCase() : '';
          if (nov && nov !== 'sin novedad' && r.nombre_asesor) {
            asesoresConNovedadTeam.add(String(r.nombre_asesor).trim().toLowerCase());
          }
        });
        // Build meta ACV by celula+period from productividad_asesores.meta (excluding novedad)
        const metaAcvByCelulaTeam = new Map<string, Map<string, number>>();
        (productividadRes.data || []).forEach((row: any) => {
          const celula = normalizeComparableText(row.celula);
          const period = String(row.anio_mes || '');
          const asesorName = normalizeComparableText(row.asesor);
          if (!celula) return;
          if (asesoresConNovedadTeam.has(asesorName)) return;
          const periodMap = metaAcvByCelulaTeam.get(celula) || new Map<string, number>();
          periodMap.set(period, (periodMap.get(period) || 0) + normalizeVnMetaAcv(row.meta, row.pais));
          metaAcvByCelulaTeam.set(celula, periodMap);
        });

        const asesorNames = new Set<string>();
        (productividadRes.data || []).forEach((row: any) => {
          if (row.asesor) asesorNames.add(normalizePersonName(row.asesor));
        });

        const roleByUserId = new Map<string, string>();
        (rolesRes.data || []).forEach((row: any) => {
          if (row.user_id && row.role) roleByUserId.set(row.user_id, row.role);
        });

        // Nombre del gerente por célula — fuente: metas_asesores.gerente (Databricks RRHH)
        // Preferimos el nombre más largo (más completo) cuando hay variantes.
        const gerenteNombreByCelula = new Map<string, string>();
        (metasAsesoresRes.data || []).forEach((row: any) => {
          const celulaKey = normalizeComparableText(row.celula);
          const gerenteName = row.gerente ? String(row.gerente).trim() : '';
          if (!celulaKey || !gerenteName || gerenteName === '0') return;
          const existing = gerenteNombreByCelula.get(celulaKey);
          if (!existing || gerenteName.length > existing.length) {
            gerenteNombreByCelula.set(celulaKey, gerenteName);
          }
        });

        const gerentesByCelula = new Map<string, { id?: string; nombre: string; sp_canje: number; sp_convencion: number }>();
        const gerentesByCell = new Map<string, Array<{ id?: string; nombre: string; sp_canje: number; sp_convencion: number; user_id?: string | null }>>();
        (gerentesRes.data || []).forEach((g: any) => {
          const celulaKey = normalizeComparableText(g.celula);
          if (!celulaKey) return;
          const list = gerentesByCell.get(celulaKey) || [];
          list.push({ id: g.id, nombre: g.nombre, sp_canje: Number(g.sp_canje) || 0, sp_convencion: Number(g.sp_convencion) || 0, user_id: g.user_id });
          gerentesByCell.set(celulaKey, list);
        });

        // Unión de células: las que tienen miembros en `gerentes` Y las que tienen nombre desde Databricks.
        const allCelulas = new Set<string>([...gerentesByCell.keys(), ...gerenteNombreByCelula.keys()]);
        allCelulas.forEach((celulaKey) => {
          const members = gerentesByCell.get(celulaKey) || [];

          // 1. Prioridad: nombre del gerente desde Databricks (metas_asesores.gerente)
          const nombreDatabricks = gerenteNombreByCelula.get(celulaKey);
          if (nombreDatabricks) {
            const normDatabricks = normalizePersonName(nombreDatabricks);
            // Buscar en members el que coincida con el nombre de Databricks (match exacto o por inclusión)
            const matchDB = members.find((m) => {
              const normMember = normalizePersonName(m.nombre);
              return normMember === normDatabricks
                || normMember.includes(normDatabricks)
                || normDatabricks.includes(normMember);
            });
            if (matchDB) {
              gerentesByCelula.set(celulaKey, matchDB);
              return;
            }
            // No tiene cuenta en Arena: entrada mínima con el nombre real
            gerentesByCelula.set(celulaKey, { nombre: nombreDatabricks, sp_canje: 0, sp_convencion: 0 });
            return;
          }

          // 2. Fallback: miembro con role='gerente' o 'admin' en user_roles
          const roleMatch = members.find((m) => {
            if (!m.user_id) return false;
            const role = roleByUserId.get(m.user_id);
            return role === 'gerente' || role === 'admin';
          });
          if (roleMatch) {
            gerentesByCelula.set(celulaKey, roleMatch);
            return;
          }

          // 3. Último fallback: primer miembro que NO sea asesor conocido
          const nonAsesor = members.find((m) => !asesorNames.has(normalizePersonName(m.nombre)));
          if (nonAsesor) {
            gerentesByCelula.set(celulaKey, nonAsesor);
          }
        });

        // Aggregate by celula + month
        const celulaAgg = new Map<string, { celulaNombre: string; months: Map<string, { ventas: number; meta: number; acv: number }>; recomendados: number; unidades: number; acv: number; currentVentas: number; currentMeta: number; currentRecomendados: number; currentAcv: number }>();
        (productividadRes.data || []).forEach((row: any) => {
          const celula = normalizeComparableText(row.celula);
          if (!celula) return;
          const agg = celulaAgg.get(celula) || { celulaNombre: row.celula || '', months: new Map(), recomendados: 0, unidades: 0, acv: 0, currentVentas: 0, currentMeta: 0, currentRecomendados: 0, currentAcv: 0 };
          if (!agg.celulaNombre && row.celula) agg.celulaNombre = row.celula;
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0, acv: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += normalizeVnMetaAcv(row.meta, row.pais);
          cm.acv += normalizeStoredAcv(row.acv_f);
          agg.months.set(period, cm);
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += normalizeStoredAcv(row.acv_f);
          if (period === currentMonth) {
            agg.currentVentas += Number(row.ventas) || 0;
            agg.currentMeta += normalizeVnMetaAcv(row.meta, row.pais);
            agg.currentRecomendados += Number(row.cant_recomendados) || 0;
            agg.currentAcv += normalizeStoredAcv(row.acv_f);
          }
          celulaAgg.set(celula, agg);
        });
        const spInputsGer = {
          vgmRows: vgmGerRes.data || [],
          metaAsesorRows: metasAsesoresRes.data || [],
          metaAcvRows: metasAcvGerRes.data || [],
          year: String(currentConventionYear),
        };
        const entries: any[] = [];
        celulaAgg.forEach((agg, celula) => {
          const monthlyRows = buildVnConventionMonthlyRows({
            productivityRows: (productividadRes.data || []).filter((row: any) => normalizeComparableText(row.celula) === celula),
            metaRows: (metasAsesoresRes.data || []).filter((row: any) => normalizeComparableText(row.celula) === celula),
            ejecRows: ejecAsesoresGerenteRes.data || [],
          });
          const currentMonthly = monthlyRows.find((row) => row.period === currentMonth);
          const celulaMetaMap = metaAcvByCelulaTeam.get(celula);
          const currentMetaAcv = celulaMetaMap?.get(currentMonth) || 0;
          const pct = currentMonthly?.pctAcv ?? (currentMetaAcv > 0 && agg.currentAcv > 0 ? Math.round((agg.currentAcv / currentMetaAcv) * 100) : 0);
          const gerenteInfo = gerentesByCelula.get(celula);

          // Ventas FE/Nube del mes actual desde ventas_gerente_mensual (fuente correcta para gerentes VN)
          const vgmMesActual = (vgmGerRes.data || []).filter((r: any) =>
            normalizeComparableText(r.celula) === celula &&
            String(r.periodo) === currentMonth
          );
          let currentFe = 0, currentNube = 0;
          vgmMesActual.forEach((r: any) => {
            const fam = String(r.familia ?? '').toUpperCase();
            if (fam === 'FE') currentFe += Math.round(Number(r.unidades) || 0);
            if (fam === 'NUBE') currentNube += Math.round(Number(r.unidades) || 0);
          });
          // Metas FE/Nube del mes actual desde metas_acv_gerentes (Cierre prioritario sobre Inicio)
          const MES_MAP: Record<string, string> = {
            ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',
            jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12'
          };
          const metasAcvMesActual =
            (metasAcvGerRes.data || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celula) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const mm = MES_MAP[mes3];
              return mm && currentMonth.endsWith(mm) &&
                !String(r.archivo ?? '').toLowerCase().includes('inicio');
            }) ||
            (metasAcvGerRes.data || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celula) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const mm = MES_MAP[mes3];
              return mm && currentMonth.endsWith(mm);
            });
          const currentMetaFe = Number(metasAcvMesActual?.meta_fe) || 0;
          const currentMetaNube = Number(metasAcvMesActual?.meta_nube) || 0;
          const capPct = (v: number) => Math.min(300, Math.max(0, Math.round(v)));
          const pctFeMes = currentMetaFe > 0 ? capPct((currentFe / currentMetaFe) * 100) : 0;
          const pctNubeMes = currentMetaNube > 0 ? capPct((currentNube / currentMetaNube) * 100) : 0;
          // SP Convención = MISMO cálculo que MiPerformance:
          // ventas_gerente_mensual + metas_asesores + metas_acv_gerentes (por celula).
          const spFinal = computeSpConvencionAnualForCelula(spInputsGer, agg.celulaNombre || celula, gerenteInfo?.nombre);
          entries.push({
            id: celula,
            nombre: gerenteInfo?.nombre || agg.celulaNombre || celula,
            celula_nombre: agg.celulaNombre || celula,
            canal: profile.canal,
            pais: userPais,
            kpi_value: Math.round(agg.currentAcv),
            acv_total_year: Math.round(agg.acv),
            meta_total: currentMetaAcv,
            meta_acv: currentMetaAcv,
            meta_unidades: currentMonthly?.metaTotal || 0,
            unidades_logradas: agg.currentVentas,
            unidades_total: agg.unidades,
            cant_recomendados: agg.currentRecomendados,
            pct_cumplimiento: pct,
            pct_fe: currentMonthly?.pctFe || 0,
            pct_nube: currentMonthly?.pctNube || 0,
            sp_totales: spFinal,
            sp_canje: gerenteInfo?.sp_canje || 0,
            nivel: null,
            posicion: 0,
          });
        });
        setRanking(entries);
      }
    } else {
      const [rankRes, kpiRes, gerentesRes] = await Promise.all([
        supabase.from('ranking_general').select('*').eq('canal', profile.canal).eq('pais', userPais),
        supabase.from('kpis_mes_actual').select('gerente_id, acv_f, sc_creados').eq('canal', profile.canal),
        supabase.from('gerentes').select('id, sp_canje').eq('canal', profile.canal).eq('pais', userPais),
      ]);
      const kpiMap = new Map<string, { acv: number; units: number }>();
      (kpiRes.data || []).forEach((k: any) => {
        if (k.gerente_id) kpiMap.set(k.gerente_id, { acv: Number(k.acv_f) || 0, units: Number(k.sc_creados) || 0 });
      });
      const canjeablesMap = new Map<string, number>();
      (gerentesRes.data || []).forEach((g: any) => {
        if (g.id) canjeablesMap.set(g.id, Number(g.sp_canje) || 0);
      });
      setRanking((rankRes.data || []).map((r: any) => ({
        ...r,
        kpi_value: kpiMap.get(r.id)?.acv || 0,
        units: kpiMap.get(r.id)?.units || 0,
        sp_canje: canjeablesMap.get(r.id) || 0,
      })));
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    fetchRanking();
    const channel = supabase
      .channel(`ranking-live-${profile?.canal}-${userPais}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, () => fetchRanking())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gerentes' }, () => fetchRanking())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asesores' }, () => fetchRanking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, profile?.canal, tab, profile?.nombre, profile?.role, userPais]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isComercialTab = (isVC || isVN) && tab === 'comerciales';
  const isGerentesVCTab = isVC && tab === 'gerentes';
  const isGerentesVNTab = isVN && tab === 'gerentes';

  // Sort by SP totales as primary, then by % cumplimiento
  const sorted = [...ranking].sort((a, b) => {
    const spDiff = (b.sp_totales || 0) - (a.sp_totales || 0);
    if (spDiff !== 0) return spDiff;
    const pctDiff = (b.pct_cumplimiento ?? 0) - (a.pct_cumplimiento ?? 0);
    if (pctDiff !== 0) return pctDiff;
    return (b.kpi_value || 0) - (a.kpi_value || 0);
  });

  const entityLabel = isComercialTab ? 'Comercial' : 'Gerente';
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 Ranking · ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Tabs + Country indicator */}
        <motion.div className="flex items-center justify-between flex-wrap gap-3" variants={fadeUpItem}>
          <div className="flex gap-2">
            {(isVC || isVN) && (
              <>
                <button onClick={() => setTab('comerciales')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'comerciales' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                  👤 {isVN ? 'Asesores' : 'Comerciales'}
                </button>
                <button onClick={() => setTab('gerentes')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'gerentes' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                  👥 Gerentes
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground">
              <FlagIcon pais={userPais} /> {PAIS_LABEL[userPais] || userPais}
            </span>
            <span className="text-[10px] text-white bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO
            </span>
          </div>
        </motion.div>

        {dataLoading ? <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {top3.map((g, i) => (
                  <motion.div
                    key={g.id}
                    className={cn(
                      "bg-white rounded-3xl border-2 p-6 text-center relative overflow-hidden shadow-smooth-sm",
                      PODIUM_COLORS[i],
                      (g.isCurrent || g.user_id === profile?.user_id) && "ring-2 ring-primary"
                    )}
                    variants={podiumBounce}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  >
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow to-transparent" />}
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mx-auto flex items-center justify-center text-3xl mb-2">🏅</div>
                    <p className="font-bold font-heading text-secondary text-lg">{g.nombre}</p>
                    {g.celula_nombre && g.celula_nombre !== g.nombre && (
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">📋 {g.celula_nombre}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <FlagIcon pais={g.pais} /> {g.canal?.replace(/_/g, ' ')}
                    </p>

                    {/* SP — HERO metric */}
                    <motion.div
                      className="mt-4 mb-3"
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: i * 0.15 + 0.5 }}
                    >
                      <div className="inline-flex items-center gap-2 bg-primary/10 rounded-2xl px-5 py-3">
                        <motion.span
                          className="text-2xl"
                          animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                        >⚡</motion.span>
                        <AnimatedCounter value={g.sp_totales || 0} className="text-3xl font-black font-scoreboard text-primary" duration={1.2} />
                        <span className="text-xs font-bold text-primary/70 font-scoreboard">Siigo Points</span>
                      </div>
                    </motion.div>

                    <div className="mt-2 flex justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold font-scoreboard text-accent">
                        🎁 {(g.sp_canje || 0).toLocaleString()} <span className="text-[10px] text-accent/70">SP Canje</span>
                      </span>
                    </div>

                    {/* Secondary metrics */}
                    <div className="flex items-center justify-center gap-3 text-xs flex-wrap">
                      {(isComercialTab || isGerentesVCTab || isGerentesVNTab) && (
                        <>
                          {/* % Cumpl — always shown */}
                          <div>
                            <p className="text-sm font-bold font-scoreboard text-foreground">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Cumpl. ACV</p>
                          </div>
                          {/* VN: FE% + Nube% + Unidades + Referidos */}
                          {(isGerentesVNTab || (isVN && isComercialTab)) && (
                            <>
                              {g.pct_fe > 0 && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div>
                                    <p className="text-sm font-bold font-scoreboard text-foreground">{g.pct_fe}%</p>
                                    <p className="text-[10px] text-muted-foreground font-heading uppercase">Cumpl. FE</p>
                                  </div>
                                </>
                              )}
                              {g.pct_nube > 0 && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div>
                                    <p className="text-sm font-bold font-scoreboard text-foreground">{g.pct_nube}%</p>
                                    <p className="text-[10px] text-muted-foreground font-heading uppercase">Cumpl. Nube</p>
                                  </div>
                                </>
                              )}
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-foreground">{(g.unidades_logradas || g.unidades_total || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Unidades</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-muted-foreground">{(g.meta_unidades || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Meta Uds</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-primary">{formatMoney(g.kpi_value)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-muted-foreground">{formatMoney(g.meta_acv)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Meta ACV</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-accent">{(g.cant_recomendados || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">{REFERIDOS_LABEL[profile?.canal || ''] || 'Referidos'}</p>
                              </div>
                            </>
                          )}
                          {/* VC: ACV + Meta */}
                          {(isComercialTab || isGerentesVCTab) && !isVN && (
                            <>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-foreground">{formatMoney(g.kpi_value)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-muted-foreground">{formatMoney(g.meta_total)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Meta</p>
                              </div>
                            </>
                          )}
                        </>
                      )}
                      {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && g.kpi_value > 0 && (
                        <div>
                          <p className="text-sm font-bold font-scoreboard text-accent">{formatMoney(g.kpi_value)}</p>
                          <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                        </div>
                      )}
                    </div>

                    {!isComercialTab && g.nivel && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span>}
                    {isComercialTab && g.gerente_nombre && <p className="text-[10px] text-muted-foreground mt-2">Líder: {g.gerente_nombre}</p>}
                    {isGerentesVNTab && g.celula_nombre && g.celula_nombre !== g.nombre && <p className="text-[10px] text-muted-foreground mt-2">📋 {g.celula_nombre}</p>}
                    {(g.isCurrent || g.user_id === profile?.user_id) && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">Tú</span>}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Full table */}
            {rest.length > 0 && (
              <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                <div className="bg-primary px-4 py-3"><p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-heading">📋 Tabla Completa</p></div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">{entityLabel}</th>
                      {isComercialTab && <th className="text-left px-4 py-3">Líder</th>}
                      <th className="text-right px-4 py-3">⚡ Siigo Points</th>
                      <th className="text-right px-4 py-3">🎁 Canjeables</th>
                      {(isComercialTab || isGerentesVCTab) && !isVN && (
                        <>
                          <th className="text-right px-4 py-3">% Cumpl.</th>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-right px-4 py-3">Meta</th>
                        </>
                      )}
                      {(isGerentesVNTab || (isVN && isComercialTab)) && (
                        <>
                           <th className="text-right px-4 py-3">% Cumpl. ACV</th>
                           <th className="text-right px-4 py-3">% FE</th>
                           <th className="text-right px-4 py-3">% Nube</th>
                          <th className="text-right px-4 py-3">Unidades</th>
                          <th className="text-right px-4 py-3">Meta Uds</th>
                          <th className="text-right px-4 py-3">ACV+</th>
                           <th className="text-right px-4 py-3">Meta ACV</th>
                          <th className="text-right px-4 py-3">{REFERIDOS_LABEL[profile?.canal || ''] || 'Referidos'}</th>
                        </>
                      )}
                      {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                        <>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-left px-4 py-3">Nivel</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr
                        key={g.id}
                        className={cn(
                          "border-b border-border hover:bg-primary/5 transition-colors",
                          (g.isCurrent || g.user_id === profile?.user_id) && "bg-primary/10 font-semibold"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FlagIcon pais={g.pais} />
                            <div>
                              <span className="text-sm text-foreground">{g.nombre}</span>
                              {g.celula_nombre && g.celula_nombre !== g.nombre && (
                                <p className="text-[10px] text-muted-foreground">📋 {g.celula_nombre}</p>
                              )}
                            </div>
                            {(g.isCurrent || g.user_id === profile?.user_id) && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        {isComercialTab && <td className="px-4 py-3 text-xs text-muted-foreground">{g.gerente_nombre || '—'}</td>}
                        {/* SP Ranking — prominent */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-black font-scoreboard text-primary">{(g.sp_totales || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-primary/60 ml-1 font-scoreboard">PTS</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-black font-scoreboard text-accent">{(g.sp_canje || 0).toLocaleString()}</span>
                        </td>
                        {(isComercialTab || isGerentesVCTab) && !isVN && (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.meta_total)}</td>
                          </>
                        )}
                        {(isGerentesVNTab || (isVN && isComercialTab)) && (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_fe != null ? `${g.pct_fe}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_nube != null ? `${g.pct_nube}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-foreground text-right">{(g.unidades_logradas || g.unidades_total || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{(g.meta_unidades || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-primary text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.meta_acv)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-accent text-right">{(g.cant_recomendados || 0).toLocaleString()}</td>
                          </>
                        )}
                        {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                          <>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span></td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {sorted.length === 0 && (
              <motion.div className="text-center py-16" variants={fadeUpItem}>
                <div className="text-7xl mb-4 opacity-30">📊</div>
                <p className="text-lg font-bold text-muted-foreground">Sin datos de ranking</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Los datos aparecerán cuando se sincronicen las ventas</p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
};

export default Rankings;
