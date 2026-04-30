// Motor de gamificación VC Colombia.
// Evalúa retos diarios/semanales/mensuales y la racha "El Artillero"
// leyendo `ventas` + `advisor_segments`, otorgando SP a `wallet_sp_canje`
// y registrando trazabilidad en `sp_transactions`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MES_NOMBRES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

type Segment = 'nube' | 'legacy';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ISO weekday: lunes=1 .. domingo=7
const isoWeekday = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = isoWeekday(x);
  x.setUTCDate(x.getUTCDate() - (wd - 1));
  return x;
}

function sundayOf(d: Date): Date {
  const m = mondayOf(d);
  const s = new Date(m);
  s.setUTCDate(s.getUTCDate() + 6);
  return s;
}

async function awardSp(
  sb: ReturnType<typeof createClient>,
  comercial: string,
  amount: number,
  sourceType: string,
  sourceId: string | null,
  description: string,
) {
  if (amount <= 0) return;

  // Insert transaction
  const { error: txErr } = await sb.from('sp_transactions').insert({
    comercial,
    transaction_type: 'earned',
    amount,
    source_type: sourceType,
    source_id: sourceId,
    description,
  });
  if (txErr) throw txErr;

  // Upsert wallet
  const { data: w } = await sb
    .from('wallet_sp_canje')
    .select('current_balance, total_earned_historically')
    .eq('comercial', comercial)
    .maybeSingle();

  const newBal = (w?.current_balance ?? 0) + amount;
  const newTotal = (w?.total_earned_historically ?? 0) + amount;

  const { error: wErr } = await sb
    .from('wallet_sp_canje')
    .upsert(
      {
        comercial,
        current_balance: newBal,
        total_earned_historically: newTotal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'comercial' },
    );
  if (wErr) throw wErr;
}

// ----- KPIs -----

async function getDailyAcv(sb: any, comercial: string, fecha: string) {
  const { data, error } = await sb
    .from('ventas')
    .select('acv_plus')
    .eq('comercial', comercial)
    .eq('fecha_facturacion', fecha)
    .eq('canal', 'VC')
    .neq('producto', 'Resumen Mensual VC')
    .or('pais.is.null,pais.eq.');
  if (error) throw error;
  return (data || []).reduce((s: number, r: any) => s + Number(r.acv_plus || 0), 0);
}

async function getWeeklyUpgrades(sb: any, comercial: string, lunes: string, domingo: string) {
  const { count, error } = await sb
    .from('ventas')
    .select('id', { count: 'exact', head: true })
    .eq('comercial', comercial)
    .eq('canal', 'VC')
    .eq('categoria_producto_venta', 'Upgrade')
    .gte('fecha_facturacion', lunes)
    .lte('fecha_facturacion', domingo)
    .or('pais.is.null,pais.eq.');
  if (error) throw error;
  return count || 0;
}

async function getMonthlyResumen(sb: any, comercial: string, mes: string, anio: number) {
  const { data, error } = await sb
    .from('ventas')
    .select('acv_plus, meta')
    .eq('comercial', comercial)
    .eq('canal', 'VC')
    .eq('producto', 'Resumen Mensual VC')
    .eq('mes', mes)
    .eq('anio', anio)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return {
    acv: Number(data?.acv_plus || 0),
    meta: Number(data?.meta || 0),
  };
}

async function getMonthlyConversionesAcv(sb: any, comercial: string, mes: string, anio: number) {
  const { data, error } = await sb
    .from('ventas')
    .select('acv_plus')
    .eq('comercial', comercial)
    .eq('canal', 'VC')
    .eq('categoria_producto_venta', 'Conversiones')
    .eq('mes', mes)
    .eq('anio', anio)
    .or('pais.is.null,pais.eq.');
  if (error) throw error;
  return (data || []).reduce((s: number, r: any) => s + Number(r.acv_plus || 0), 0);
}

// ----- Evaluación -----

async function evaluate(targetDate: Date) {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = isoDate(targetDate);
  const wd = isoWeekday(targetDate);
  const lunes = isoDate(mondayOf(targetDate));
  const domingo = isoDate(sundayOf(targetDate));
  const mes = MES_NOMBRES[targetDate.getUTCMonth()];
  const anio = targetDate.getUTCFullYear();

  const summary = {
    date: today,
    weekday: wd,
    daily_awards: 0,
    weekly_awards: 0,
    monthly_awards: 0,
    streak_progress_rows: 0,
    streak_bonuses: 0,
    skipped_no_segment: 0,
  };

  // Asesores con segmento
  const { data: segs, error: segErr } = await sb
    .from('advisor_segments')
    .select('comercial, segment');
  if (segErr) throw segErr;
  const segMap = new Map<string, Segment>(
    (segs || []).map((s: any) => [s.comercial, s.segment as Segment]),
  );

  // Cargar challenges + thresholds
  const { data: challenges, error: chErr } = await sb
    .from('gamification_challenges')
    .select('id, name, frequency, kpi_type, evaluation_scope, status, start_date, end_date')
    .eq('status', 'active');
  if (chErr) throw chErr;

  const { data: thresholds, error: thErr } = await sb
    .from('challenge_thresholds')
    .select('challenge_id, segment, threshold_value, sp_canje_reward');
  if (thErr) throw thErr;

  const thByChallenge = new Map<string, Map<Segment, { v: number | null; sp: number }>>();
  for (const t of thresholds || []) {
    const m = thByChallenge.get(t.challenge_id) || new Map();
    m.set(t.segment as Segment, { v: t.threshold_value, sp: t.sp_canje_reward });
    thByChallenge.set(t.challenge_id, m);
  }

  // Fecha en rango de vigencia
  const inRange = (c: any) => today >= c.start_date && today <= c.end_date;

  // Iterar asesores con segmento
  for (const [comercial, segment] of segMap) {
    if (!segment) {
      summary.skipped_no_segment++;
      continue;
    }

    for (const c of challenges || []) {
      if (!inRange(c)) continue;
      const th = thByChallenge.get(c.id)?.get(segment);
      if (!th) continue;            // segmento no aplica (ej. Contraataque legacy)
      if (th.v == null) continue;   // umbral pendiente
      if (th.sp <= 0) continue;

      // ---- DAILY ----
      if (c.frequency === 'daily' && c.kpi_type === 'acv_plus' && c.evaluation_scope === 'amount') {
        const daily = await getDailyAcv(sb, comercial, today);
        if (daily >= Number(th.v)) {
          const { error } = await sb.from('advisor_challenge_completions').insert({
            comercial,
            challenge_id: c.id,
            completion_date: today,
            acv_achieved: daily,
            sp_awarded: th.sp,
          });
          if (!error) {
            await awardSp(sb, comercial, th.sp, 'challenge', c.id, `Reto ${c.name} — ${today}`);
            summary.daily_awards++;
          }
        }
      }

      // ---- WEEKLY ----
      if (c.frequency === 'weekly' && c.kpi_type === 'upgrades' && c.evaluation_scope === 'count') {
        // Evaluar al cierre de semana (domingo) o cuando hoy = domingo / explícito
        if (wd !== 7) continue;
        const upgrades = await getWeeklyUpgrades(sb, comercial, lunes, domingo);
        if (upgrades >= Number(th.v)) {
          const { error } = await sb.from('advisor_challenge_completions').insert({
            comercial,
            challenge_id: c.id,
            completion_date: domingo,
            acv_achieved: upgrades, // reusamos columna para guardar el conteo
            sp_awarded: th.sp,
          });
          if (!error) {
            await awardSp(sb, comercial, th.sp, 'challenge', c.id, `Reto ${c.name} — semana ${lunes}`);
            summary.weekly_awards++;
          }
        }
      }

      // ---- MONTHLY ----
      if (c.frequency === 'monthly' && c.evaluation_scope === 'percentage') {
        // Evaluar diariamente; UNIQUE evita duplicados.
        const completionDate = `${anio}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-01`;

        if (c.kpi_type === 'acv_plus') {
          const { acv, meta } = await getMonthlyResumen(sb, comercial, mes, anio);
          const pct = meta > 0 ? (acv / meta) * 100 : 0;
          if (pct >= Number(th.v)) {
            const { error } = await sb.from('advisor_challenge_completions').insert({
              comercial,
              challenge_id: c.id,
              completion_date: completionDate,
              acv_achieved: pct,
              sp_awarded: th.sp,
            });
            if (!error) {
              await awardSp(sb, comercial, th.sp, 'challenge', c.id, `Reto ${c.name} — ${mes} ${anio}`);
              summary.monthly_awards++;
            }
          }
        }

        if (c.kpi_type === 'conversiones') {
          const { meta } = await getMonthlyResumen(sb, comercial, mes, anio);
          if (meta <= 0) continue;
          const convAcv = await getMonthlyConversionesAcv(sb, comercial, mes, anio);
          const pct = (convAcv / meta) * 100;
          if (pct >= Number(th.v)) {
            const { error } = await sb.from('advisor_challenge_completions').insert({
              comercial,
              challenge_id: c.id,
              completion_date: completionDate,
              acv_achieved: pct,
              sp_awarded: th.sp,
            });
            if (!error) {
              await awardSp(sb, comercial, th.sp, 'challenge', c.id, `Reto ${c.name} — ${mes} ${anio}`);
              summary.monthly_awards++;
            }
          }
        }
      }
    }
  }

  // ---- RACHA "El Artillero" ----
  const { data: streaks } = await sb
    .from('gamification_streaks')
    .select('id, name, active_weekdays, evaluation_weekday, multiplier_reward, start_date, end_date, status')
    .eq('status', 'active');

  const { data: streakTh } = await sb.from('streak_thresholds').select('streak_id, segment, daily_threshold_cop');
  const sthByStreak = new Map<string, Map<Segment, number>>();
  for (const t of streakTh || []) {
    const m = sthByStreak.get(t.streak_id) || new Map();
    m.set(t.segment as Segment, Number(t.daily_threshold_cop));
    sthByStreak.set(t.streak_id, m);
  }

  for (const st of streaks || []) {
    if (!(today >= st.start_date && today <= st.end_date)) continue;
    const activeDays: number[] = st.active_weekdays || [];
    const evalDay: number = st.evaluation_weekday;

    // Día activo: registrar progreso diario
    if (activeDays.includes(wd)) {
      for (const [comercial, segment] of segMap) {
        const threshold = sthByStreak.get(st.id)?.get(segment);
        if (threshold == null) continue;
        const daily = await getDailyAcv(sb, comercial, today);
        const met = daily >= threshold;

        const { error } = await sb.from('streak_daily_progress').upsert(
          {
            streak_id: st.id,
            comercial,
            progress_date: today,
            weekday: wd,
            acv_achieved: daily,
            threshold_required: threshold,
            met,
          },
          { onConflict: 'streak_id,comercial,progress_date' },
        );
        if (!error) summary.streak_progress_rows++;
      }
    }

    // Día de evaluación: dar bonus
    if (wd === evalDay) {
      const lunesStr = lunes;
      const viernesDate = new Date(targetDate);
      const viernesStr = today;

      for (const [comercial, segment] of segMap) {
        if (!sthByStreak.get(st.id)?.has(segment)) continue;

        const { data: prog } = await sb
          .from('streak_daily_progress')
          .select('weekday, met')
          .eq('streak_id', st.id)
          .eq('comercial', comercial)
          .gte('progress_date', lunesStr)
          .lte('progress_date', viernesStr);

        const metDays = new Set((prog || []).filter((p: any) => p.met).map((p: any) => p.weekday));
        const allMet = activeDays.every((d) => metDays.has(d));
        if (!allMet) continue;

        // Idempotencia: ¿ya recibió bonus esta semana?
        const dedupDesc = `Racha ${st.name} 2X — semana ${lunesStr}`;
        const { data: prev } = await sb
          .from('sp_transactions')
          .select('id')
          .eq('comercial', comercial)
          .eq('source_type', 'streak')
          .eq('source_id', st.id)
          .eq('description', dedupDesc)
          .limit(1);
        if (prev && prev.length) continue;

        // Sumar SP base de la semana (lun→vie)
        const { data: txs } = await sb
          .from('sp_transactions')
          .select('amount, source_type')
          .eq('comercial', comercial)
          .eq('transaction_type', 'earned')
          .neq('source_type', 'streak')
          .gte('created_at', `${lunesStr}T00:00:00Z`)
          .lte('created_at', `${viernesStr}T23:59:59Z`);
        const baseWeekSp = (txs || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
        const bonus = Math.floor(baseWeekSp * (Number(st.multiplier_reward) - 1));
        if (bonus <= 0) continue;

        await awardSp(sb, comercial, bonus, 'streak', st.id, dedupDesc);
        summary.streak_bonuses++;
      }
    }
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dateStr: string | undefined = body?.date;
    const target = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
    target.setUTCHours(12, 0, 0, 0);

    const summary = await evaluate(target);

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('evaluar-gamificacion-vc error', e);
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
