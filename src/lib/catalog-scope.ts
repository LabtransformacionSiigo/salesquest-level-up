export interface CatalogScopeProfile {
  id?: string | null;
  gerente_id?: string | null;
  canal?: string | null;
  pais?: string | null;
  role?: string | null;
}

export interface ScopedCatalogItem {
  canal: string | null;
  pais: string | null;
  gerente_id: string | null;
}

const normalizeText = (value?: string | null) => String(value || '').trim().toUpperCase();

export const getCatalogTargetGerenteId = (profile?: CatalogScopeProfile | null) => (
  profile?.role === 'asesor' ? (profile?.gerente_id || null) : (profile?.id || null)
);

export const matchesCatalogScope = <T extends ScopedCatalogItem>(item: T, profile?: CatalogScopeProfile | null) => {
  if (!profile) return false;

  const canalOk = !item.canal || normalizeText(item.canal) === normalizeText(profile.canal);
  const paisOk = !item.pais || normalizeText(item.pais) === normalizeText(profile.pais);
  const targetGerenteId = getCatalogTargetGerenteId(profile);
  const gerenteOk = !item.gerente_id || (!!targetGerenteId && item.gerente_id === targetGerenteId);

  return canalOk && paisOk && gerenteOk;
};

export const filterCatalogByScope = <T extends ScopedCatalogItem>(items: T[], profile?: CatalogScopeProfile | null) => (
  items.filter((item) => matchesCatalogScope(item, profile))
);

export const normalizeCatalogWindow = (value?: string | null) => normalizeText(value);