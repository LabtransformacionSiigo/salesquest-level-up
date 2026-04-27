import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const normalizeText = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

interface Props {
  gerenteNombre: string;
  celula: string | null;
  canalDireccion: string | null;
  pais: string | null;
}

interface MonthData {
  periodo: string;
  ventas_fe: number;
  ventas_nube: number;
  ventas_total: number;
  acv_total: number;
  meta_fe: number;
  meta_nube: number;
  meta_total: number;
  meta_acv: number;
  pct_fe: number;
  pct_nube: number;
  pct_total: number;
  pct_acv: number;
  sp_mes: number;
}

const fmtMoney = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};

const colorByPct = (pct: number, hasMeta: boolean): string => {
  if (!hasMeta) return 'bg-muted';
  if (pct >= 100) return 'bg-accent';
  if (pct >= 70) return 'bg-primary';
  if (pct >= 40) return 'bg-orange';
  return 'bg-destructive';
};

const textColorByPct = (pct: number, hasMeta: boolean): string => {
  if (!hasMeta) return 'text-muted-foreground';
  if (pct >= 100) return 'text-accent';
  if (pct >= 70) return 'text-primary';
  if (pct >= 40) return 'text-orange';
  return 'text-destructive';
};

const badgeColorByPct = (pct: number): string => {
  if (pct >= 100) return 'bg-accent/15 text-accent border-accent/30';
  if (pct >= 70) return 'bg-primary/15 text-primary border-primary/30';
  if (pct >= 40) return 'bg-orange/15 text-orange border-orange/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
};

const KpiCell = ({
  label,
  current,
  meta,
  pct,
  isMoney = false,
}: {
  label: string;
  current: number;
  meta: number;
  pct: number;
  isMoney?: boolean;
}) => {
  const hasMeta = meta > 0;
  const fmtFn = isMoney ? fmtMoney : (v: number) => v.toLocaleString();

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-scoreboard font-bold text-foreground">
        {hasMeta ? `${fmtFn(current)} / ${fmtFn(meta)}` : '—'}
      </p>
      {hasMeta ? (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full transition-all duration-500', colorByPct(pct, hasMeta))}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5" />
      )}
      <p className={cn('text-[11px] font-scoreboard font-bold', textColorByPct(pct, hasMeta))}>
        {hasMeta ? `${pct}%` : '—'}
      </p>
    </div>
  );
};

export const EquipoMensualGrid = ({ gerenteNombre, celula, canalDireccion, pais }: Props) => {
  const [meses, setMeses] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const year = '2026';
      const gerenteNorm = normalizeText(gerenteNombre);
      const celulaNorm = normalizeText(celula);

      const MES3_TO_YYYYMM: Record<string, string> = {
        ene: `${year}01`, feb: `${year}02`, mar: `${year}03`, abr: `${year}04`,
        may: `${year}05`, jun: `${year}06`, jul: `${year}07`, ago: `${year}08`,
        sep: `${year}09`, oct: `${year}10`, nov: `${year}11`, dic: `${year}12`,
      };

      // 1) ventas_gerente_mensual — sin filtro de canal en WHERE, filtrar en cliente
      const { data: vgmRaw } = await supabase
        .from('ventas_gerente_mensual')
        .select('periodo, familia, unidades, acv, celula, gerente_normalizado, canal_direccion')
        .gte('periodo', `${year}01`)
        .lte('periodo', `${year}12`)
        .limit(5000);

      const vgmFiltradas = (vgmRaw || []).filter((row: any) => {
        if (celulaNorm && normalizeText(row.celula) === celulaNorm) return true;
        if (gerenteNorm && normalizeText(row.gerente_normalizado) === gerenteNorm) return true;
        return false;
      });

      // metas_asesores — query reservada para vista individual de asesor.
      // Para gerentes VN, meta_fe/meta_nube vienen de metas_acv_gerentes (abajo).
      await supabase
        .from('metas_asesores')
        .select('anio_mes')
        .gte('anio_mes', `${year}01`)
        .lte('anio_mes', `${year}12`)
        .limit(1);


      // metas_acv_gerentes — fuente única de meta_fe / meta_nube / meta_acv para gerentes
      const { data: metasAcvRaw } = await supabase
        .from('metas_acv_gerentes')
        .select('celula, mes, meta_fe, meta_nube, meta_total_acv')
        .limit(500);

      const metasPorPeriodo = new Map<string, { meta_fe: number; meta_nube: number; meta_acv: number }>();
      (metasAcvRaw || [])
        .filter((row: any) => celulaNorm && normalizeText(row.celula) === celulaNorm)
        .forEach((row: any) => {
          const mesKey = String(row.mes ?? '').trim().toLowerCase().slice(0, 3);
          const periodo = MES3_TO_YYYYMM[mesKey];
          if (!periodo) return;
          const cur = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_acv: 0 };
          cur.meta_fe += Number(row.meta_fe) || 0;
          cur.meta_nube += Number(row.meta_nube) || 0;
          cur.meta_acv += Number(row.meta_total_acv) || 0;
          metasPorPeriodo.set(periodo, cur);
        });

      // Combinar todos los periodos posibles (ventas + metas gerente)
      const periodSet = new Set<string>();
      vgmFiltradas.forEach((r: any) => { if (/^\d{6}$/.test(String(r.periodo))) periodSet.add(String(r.periodo)); });
      metasPorPeriodo.forEach((_, p) => periodSet.add(p));

      const cap = (v: number) => Math.min(300, Math.max(0, Math.round(v)));

      const arr: MonthData[] = [...periodSet].map((periodo) => {
        const vgm = vgmFiltradas.filter((r: any) => String(r.periodo) === periodo);
        const metas = metasPorPeriodo.get(periodo) ?? { meta_fe: 0, meta_nube: 0, meta_acv: 0 };

        let ventas_fe = 0, ventas_nube = 0, ventas_total = 0, acv_total = 0;
        vgm.forEach((r: any) => {
          const u = Math.round(Number(r.unidades) || 0);
          const acv = Number(r.acv) || 0;
          const fam = String(r.familia || '').toUpperCase();
          if (fam === 'FE') ventas_fe += u;
          else if (fam === 'NUBE') ventas_nube += u;
          if (fam === 'FE' || fam === 'NUBE' || fam === 'CONTADOR') ventas_total += u;
          acv_total += acv;
        });

        const meta_total = metas.meta_fe + metas.meta_nube;
        const pct_fe = metas.meta_fe > 0 ? cap((ventas_fe / metas.meta_fe) * 100) : 0;
        const pct_nube = metas.meta_nube > 0 ? cap((ventas_nube / metas.meta_nube) * 100) : 0;
        const pct_total = meta_total > 0 ? cap((ventas_total / meta_total) * 100) : 0;
        const pct_acv = metas.meta_acv > 0 ? cap((acv_total / metas.meta_acv) * 100) : 0;
        const sp_mes = pct_fe + pct_nube * 2 + pct_acv;

        return {
          periodo,
          ventas_fe, ventas_nube, ventas_total, acv_total,
          meta_fe: metas.meta_fe,
          meta_nube: metas.meta_nube,
          meta_total,
          meta_acv: metas.meta_acv,
          pct_fe, pct_nube, pct_total, pct_acv, sp_mes,
        };
      });

      const filtered = arr.filter((m) =>
        m.ventas_fe > 0 || m.ventas_nube > 0 || m.ventas_total > 0 || m.acv_total > 0 ||
        m.meta_fe > 0 || m.meta_nube > 0 || m.meta_total > 0 || m.meta_acv > 0
      );

      filtered.sort((a, b) => b.periodo.localeCompare(a.periodo));

      if (!cancelled) {
        setMeses(filtered);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gerenteNombre, celula, canalDireccion, pais]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold font-heading text-secondary">📅 Historial Mensual del Equipo</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (meses.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground shadow-smooth-sm">
        Sin datos mensuales disponibles.
      </div>
    );
  }



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold font-heading text-secondary flex items-center gap-2">
            <span className="text-primary">📅</span> Historial Mensual del Equipo
          </h3>
          <p className="text-xs text-muted-foreground">
            Cumplimiento por mes · {meses.length} mes{meses.length !== 1 ? 'es' : ''} con datos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {meses.map((m, idx) => {
          const mesIdx = parseInt(m.periodo.slice(4), 10) - 1;
          const monthLabel = `${MONTH_LABELS[mesIdx]} ${m.periodo.slice(0, 4)}`;
          const hasAcvMeta = m.meta_acv > 0;

          return (
            <motion.div
              key={m.periodo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-smooth-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-base font-black font-heading text-foreground">{monthLabel}</span>
                  {hasAcvMeta && (
                    <span className={cn(
                      'text-[11px] font-bold font-scoreboard px-2.5 py-1 rounded-full border',
                      badgeColorByPct(m.pct_acv)
                    )}>
                      {m.pct_acv}% ACV+
                    </span>
                  )}
                </div>
                {m.sp_mes > 0 && (
                  <span className="text-xs font-bold font-scoreboard text-primary flex items-center gap-1">
                    ⚡ +{m.sp_mes.toLocaleString()} SP
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCell label="FE" current={m.ventas_fe} meta={m.meta_fe} pct={m.pct_fe} />
                <KpiCell label="Nube" current={m.ventas_nube} meta={m.meta_nube} pct={m.pct_nube} />
                <KpiCell label="Total" current={m.ventas_total} meta={m.meta_total} pct={m.pct_total} />
                <KpiCell label="ACV+" current={m.acv_total} meta={m.meta_acv} pct={m.pct_acv} isMoney />
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};

export default EquipoMensualGrid;
