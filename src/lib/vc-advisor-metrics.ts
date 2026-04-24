export interface VcAdvisorSaleLike {
  fecha_facturacion: string;
  valor_producto?: number | null;
  acv_plus?: number | null;
  producto?: string | null;
  comercial?: string | null;
  gerente_id?: string | null;
}

export interface MedalLike {
  nombre: string;
  condicion_tipo: string;
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
  producto?: string | null;
  cantidad_requerida?: number | null;
  sp: number;
  emoji?: string | null;
}

export const normalizePersonName = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeProductText = (value?: string | null) =>
  normalizePersonName(value)
    .replace(/[^a-z0-9+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const filterVcAdvisorSales = <T extends VcAdvisorSaleLike>(sales: T[], advisorName?: string | null, gerenteId?: string | null) => {
  const normalizedAdvisor = normalizePersonName(advisorName);
  return (sales || []).filter((sale) => {
    const sameAdvisor = normalizePersonName(sale.comercial) === normalizedAdvisor;
    const sameGerente = gerenteId ? sale.gerente_id === gerenteId : true;
    return sameAdvisor && sameGerente;
  });
};

export const calculateSpFromRevenue = (ingresosCop: number) => {
  if (ingresosCop >= 500000000) return 90 + Math.floor((ingresosCop - 500000000) / 5000000);
  if (ingresosCop >= 300000000) return 50;
  if (ingresosCop >= 200000000) return 30;
  if (ingresosCop >= 150000000) return 20;
  if (ingresosCop >= 100000000) return 12;
  if (ingresosCop >= 50000000) return 5;
  if (ingresosCop >= 10000000) return 1;
  return 0;
};

type VcProductBucket = 'fe' | 'nomina' | 'conversiones' | 'otros';

export const inferVcProductBucket = (product?: string | null): VcProductBucket => {
  const normalized = normalizeProductText(product);
  if (!normalized) return 'otros';
  if (normalized.includes('conversion')) return 'conversiones';
  if (normalized.includes('nomina') || normalized.includes('rrhh')) return 'nomina';
  if (
    normalized === 'fe' ||
    normalized.startsWith('fe ') ||
    normalized.includes(' fe ') ||
    normalized.includes('factura electronica') ||
    normalized.includes('documentos electronicos') ||
    normalized.includes('certificado digital')
  ) {
    return 'fe';
  }
  return 'otros';
};

const doesVcSaleMatchMedalProduct = (saleProduct?: string | null, medalProduct?: string | null) => {
  if (!medalProduct) return false;

  const medalBucket = inferVcProductBucket(medalProduct);
  if (medalBucket !== 'otros') {
    return inferVcProductBucket(saleProduct) === medalBucket;
  }

  const saleText = normalizeProductText(saleProduct);
  const medalText = normalizeProductText(medalProduct);
  return !!saleText && !!medalText && (saleText.includes(medalText) || medalText.includes(saleText));
};

const getISOWeekKey = (dateValue: string) => {
  const raw = new Date(dateValue);
  if (Number.isNaN(raw.getTime())) return '';
  const date = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentWeekRange = () => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sundayExclusive = new Date(monday);
  sundayExclusive.setUTCDate(sundayExclusive.getUTCDate() + 7);
  return {
    weekKey: `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    start: monday.toISOString().split('T')[0],
    end: sundayExclusive.toISOString().split('T')[0],
  };
};

export const getVcAdvisorDerivedMetrics = (sales: VcAdvisorSaleLike[]) => {
  const byWeek = new Map<string, number>();
  const byMonth = new Map<string, { acv: number; revenue: number; unidades: number }>();
  const currentMonthKey = getCurrentMonthKey();
  const { start, end } = getCurrentWeekRange();
  const todayKey = new Date().toISOString().split('T')[0];

  let totalSp = 0;
  let currentWeekRevenue = 0;
  let currentMonthRevenue = 0;
  let currentMonthAcv = 0;
  let currentMonthUnits = 0;
  let todaySalesCount = 0;

  for (const sale of sales || []) {
    const revenue = Number(sale.valor_producto) || 0;
    const acv = Number(sale.acv_plus) || 0;
    const date = sale.fecha_facturacion;
    const weekKey = getISOWeekKey(date);
    const monthKey = date?.slice(0, 7) || '';

    byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + revenue);

    const monthEntry = byMonth.get(monthKey) || { acv: 0, revenue: 0, unidades: 0 };
    monthEntry.acv += acv;
    monthEntry.revenue += revenue;
    monthEntry.unidades += 1;
    byMonth.set(monthKey, monthEntry);

    if (date === todayKey) todaySalesCount += 1;
    if (date >= start && date < end) currentWeekRevenue += revenue;
    if (monthKey === currentMonthKey) {
      currentMonthRevenue += revenue;
      currentMonthAcv += acv;
      currentMonthUnits += 1;
    }
  }

  byWeek.forEach((revenue) => {
    totalSp += calculateSpFromRevenue(revenue);
  });

  const monthlyHistory = [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([monthKey, values]) => ({
      period: monthKey,
      mes: monthKey.slice(5, 7),
      anio: monthKey.slice(0, 4),
      acv_plus_total: values.acv,
      ventas: values.revenue,
      unidades: values.unidades,
    }));

  return {
    totalSp,
    currentWeekRevenue,
    currentMonthRevenue,
    currentMonthAcv,
    currentMonthUnits,
    todaySalesCount,
    monthlyHistory,
    totalAcv: (sales || []).reduce((sum, sale) => sum + (Number(sale.acv_plus) || 0), 0),
  };
};

export const getVcAdvisorBlockTotals = (sales: VcAdvisorSaleLike[]) => {
  return (sales || []).reduce(
    (totals, sale) => {
      const acv = Number(sale.acv_plus) || 0;
      const bucket = inferVcProductBucket(sale.producto);

      if (bucket === 'fe') totals.acv_fe += acv;
      if (bucket === 'nomina') totals.acv_nomina += acv;
      if (bucket === 'conversiones') totals.acv_conversiones += acv;

      return totals;
    },
    { acv_fe: 0, acv_nomina: 0, acv_conversiones: 0 }
  );
};

export const hasVcAdvisorSalesEveryDaySoFar = (sales: VcAdvisorSaleLike[]) => {
  const { start } = getCurrentWeekRange();
  const todayKey = new Date().toISOString().split('T')[0];
  const saleDates = new Set((sales || []).map((sale) => sale.fecha_facturacion));

  const cursor = new Date(`${start}T00:00:00Z`);
  while (cursor.toISOString().split('T')[0] <= todayKey) {
    if (!saleDates.has(cursor.toISOString().split('T')[0])) {
      return false;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return true;
};

export const getUnlockedVcAdvisorMedals = (catalog: MedalLike[], sales: VcAdvisorSaleLike[]) => {
  const totalAcv = (sales || []).reduce((sum, sale) => sum + (Number(sale.acv_plus) || 0), 0);

  return (catalog || []).filter((medal) => {
    const required = Number(medal.cantidad_requerida) || 0;
    const matchedSalesCount = (sales || []).filter((sale) => doesVcSaleMatchMedalProduct(sale.producto, medal.producto)).length;

    if (medal.condicion_tipo === 'monto') return totalAcv >= required;
    if (medal.condicion_tipo === 'primera_venta') return matchedSalesCount >= 1;
    if (medal.condicion_tipo === 'cantidad') return matchedSalesCount >= Math.max(required, 1);
    return false;
  });
};
