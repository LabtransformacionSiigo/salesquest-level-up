export interface CatalogScopeProfile {
  id?: string | null;
  gerente_id?: string | null;
  canal?: string | null;
  pais?: string | null;
  role?: string | null;
}

export interface ScopedCatalogItem {
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

const normalizeText = (value?: string | null) => String(value || '').trim().toUpperCase();

export const getCatalogTargetGerenteId = (profile?: CatalogScopeProfile | null) => (
  profile?.role === 'asesor' ? (profile?.gerente_id || null) : (profile?.id || null)
);

/** True si la fecha actual cae dentro de la vigencia del item (campos opcionales). */
export const isCatalogVigente = (item: { fecha_inicio?: string | null; fecha_fin?: string | null }, today?: string): boolean => {
  const hoy = today ?? new Date().toISOString().slice(0, 10);
  if (item.fecha_inicio && hoy < item.fecha_inicio) return false;
  if (item.fecha_fin && hoy > item.fecha_fin) return false;
  return true;
};

export const matchesCatalogScope = <T extends ScopedCatalogItem>(item: T, profile?: CatalogScopeProfile | null): boolean => {
  if (!profile) return false;

  const canalOk = !item.canal || normalizeText(item.canal) === normalizeText(profile.canal);
  const paisOk = !item.pais || normalizeText(item.pais) === normalizeText(profile.pais);
  const targetGerenteId = getCatalogTargetGerenteId(profile);
  const gerenteOk = !item.gerente_id || (!!targetGerenteId && item.gerente_id === targetGerenteId);
  const vigenteOk = isCatalogVigente(item);

  return canalOk && paisOk && gerenteOk && vigenteOk;
};

export const filterCatalogByScope = <T extends ScopedCatalogItem>(items: T[], profile?: CatalogScopeProfile | null): T[] =>
  items.filter((item) => matchesCatalogScope(item, profile));

export const normalizeCatalogWindow = (value?: string | null) => normalizeText(value);

/** Cuenta los días hábiles (lun-vie) de un mes dado. Año y mes 1-12. */
export const getDiasHabiles = (year: number, month: number): number => {
  let count = 0;
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

/**
 * Calcula el umbral efectivo de un reto en función de su `tipo_metrica`.
 * - DIARIO_HABILES: meta_familia_mes / dias_habiles_mes_actual
 * - PORCENTAJE / UNIDADES / ACV: usa el `umbral` tal cual está parametrizado.
 */
export const calcularUmbralEfectivo = (
  reto: { tipo_metrica?: string | null; umbral?: number | null },
  context?: { metaMes?: number; year?: number; month?: number }
): number => {
  const tipo = String(reto.tipo_metrica ?? '').toUpperCase();
  if (tipo === 'DIARIO_HABILES' && context?.metaMes && context?.year && context?.month) {
    const dh = getDiasHabiles(context.year, context.month);
    return dh > 0 ? Math.ceil(context.metaMes / dh) : 0;
  }
  return Number(reto.umbral ?? 0);
};