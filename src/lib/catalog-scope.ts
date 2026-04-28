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