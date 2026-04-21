/**
 * Mapeo oficial de SKUs Siigo → Familia (FE / NUBE / CONTADOR) por país.
 *
 * Fuente única de verdad para:
 *  - Cálculo de unidades/ACV en Aliados y Empresarios (cuando se requiera
 *    reclasificación en cliente). El pipeline de Databricks ya entrega
 *    `ventas_fe / ventas_nube / ventas_total` pre-categorizado, pero estas
 *    listas garantizan consistencia en validaciones y administración.
 *  - Selectores de SKU/familia en AdminMedallas y AdminRetos por país.
 *
 * Reglas:
 *  - CONTADOR no cuenta como FE ni como NUBE para cálculo de SP de
 *    convención.
 *  - México NO tiene familia CONTADOR.
 *  - "Nube Facturación" y "Nube Facturación Duo" en MEX pertenecen a FE,
 *    no a NUBE.
 */

export type ProductFamily = 'FE' | 'NUBE' | 'CONTADOR';
export type CountryCode = 'COL' | 'ECU' | 'MEX' | 'URU';

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  COL: 'Colombia',
  ECU: 'Ecuador',
  MEX: 'México',
  URU: 'Uruguay',
};

interface CountryFamilyMap {
  FE: string[];
  NUBE: string[];
  CONTADOR?: string[];
}

export const PRODUCT_FAMILIES_BY_COUNTRY: Record<CountryCode, CountryFamilyMap> = {
  COL: {
    FE: [
      'FE (24 Doc)', 'FE (24 Doc) WP', 'FE (60 Doc)', 'FE (80 Doc)',
      'FE (100 Doc)', 'FE (120 Doc)', 'FE (120 Doc) WP', 'FE (260 Doc)',
      'FE (300 Doc)', 'FE (1500 Doc)', 'FE PRO',
      'Nomina Base', 'Nomina Lite 2 (24 Doc)', 'Nomina Lite 10 (120 Doc)',
      'Nomina Lite 25 (300 Doc)', 'Nomina Plus', 'Nomina Pro',
      'POS', 'POS INICIO', 'POS AVANZADO', 'POS ESENCIAL',
      'Pos Gastrobar PRO', 'Siigo POS',
    ],
    NUBE: [
      'Contai Ili', 'Mto', 'Nomina Ili',
      'Nuevo Siigo Nube', 'Nuevo Siigo Nube Emprendedor', 'Nuevo Siigo Nube Premium',
      'Nube Profesional Independiente',
      'SCI Ili', 'SCI - Fusionado Ili',
      'Siigo Nube Lite', 'Siigo Pyme',
    ],
    CONTADOR: ['Contador'],
  },
  ECU: {
    FE: [
      'FE (10 Doc)', 'FE (20 Doc)', 'FE (48 Doc)', 'FE (50 Doc)',
      'FE (96 Doc)', 'FE (100 Doc)', 'FE (120 Doc)', 'FE (240 Doc)',
      'FE (480 Doc)', 'FE (600 Doc)', 'FE (1200 Doc)', 'FE (2400 Doc)',
      'FE ILI', 'POS',
      'Contador 3', 'Contador 5', 'Contador 10', 'Contador 15', 'Contador Ilimitado',
    ],
    NUBE: ['Esencial', 'Gestion Plus', 'Nube', 'Plus', 'Premium'],
  },
  MEX: {
    FE: [
      'ADM Basica', 'ADM Basica (20 Tim)', 'ADM Basica (50 Tim)', 'ADM Basica (100 Tim)',
      'Aspel BANCO', 'Aspel CAJA',
      'Aspel Fact 1 Emp', 'Aspel Fact 2 a 99 Emp',
      'NOI Asist (6 a 25 Emp)', 'NOI Asist (26 a 50 Emp)',
      'NOI Asist (51 a 100 Emp)', 'NOI Asist (101 a 200 Emp)',
      'NOI Asist (201 a 500 Emp)', 'NOI Asist (501 a 1000 Emp)',
      'NOI Asist (+1000 Emp)',
      'Nube Facturacion', 'Nube Facturacion Duo',
    ],
    NUBE: [
      'ADM Premium',
      'Aspel COI', 'Aspel NOI', 'Aspel SAE',
      'Gestion Avanzado', 'Gestion Inicio', 'Gestion Premium',
      'Gestion Total Avanzado', 'Gestion Total Inicio', 'Gestion Total Premium',
      'Fiscal Corporativo', 'Fiscal Descargas', 'Fiscal Despachos',
      'Fiscal Empresarial', 'Fiscal Pyme',
    ],
  },
  URU: {
    FE: [
      'API', 'FE (5 Doc)', 'FE (5 Doc 2023)', 'FE (50 Doc)', 'FE (100 Doc)',
      'FE (Geocom)', 'FE (Libre)', 'FE (Literal E) POS', 'FE (Monotributo)',
      'FE (PRO)', 'FE (Resonance)', 'POS', 'POS Movil',
    ],
    NUBE: [
      'Emprendedor', 'Figaro', 'Figaro + FE', 'Figaro Educativo',
      'POS', 'Premium', 'Pyme',
      'Recibos SE', 'Recibos SE 1 a 15', 'Recibos SE 16 a 30',
      'Recibos SE 31 a 60', 'Recibos SE 60 a 120',
      'Worky', 'Worky Educativo',
      'Contador', 'Conty Educativo', 'Conty Educativo(Inst)', 'Conty Full',
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Normalización + helpers                                           */
/* ------------------------------------------------------------------ */

/** Normaliza para comparar SKUs ignorando acentos, mayúsculas y espacios extra. */
export const normalizeSku = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Construye un índice {skuNormalizado → familia} por país (memoizado). */
const FAMILY_INDEX: Record<CountryCode, Map<string, ProductFamily>> = (() => {
  const out = {} as Record<CountryCode, Map<string, ProductFamily>>;
  (Object.keys(PRODUCT_FAMILIES_BY_COUNTRY) as CountryCode[]).forEach((pais) => {
    const idx = new Map<string, ProductFamily>();
    const fam = PRODUCT_FAMILIES_BY_COUNTRY[pais];
    fam.FE.forEach((s) => idx.set(normalizeSku(s), 'FE'));
    fam.NUBE.forEach((s) => idx.set(normalizeSku(s), 'NUBE'));
    fam.CONTADOR?.forEach((s) => idx.set(normalizeSku(s), 'CONTADOR'));
    out[pais] = idx;
  });
  return out;
})();

/**
 * Resuelve la familia de un producto dado su país.
 * - Acepta tanto el nombre del SKU como el nombre de la familia
 *   ("FE" / "NUBE" / "CONTADOR") que viene pre-categorizado en
 *   COL/ECU/URU desde el pipeline de Databricks.
 * - Devuelve `null` si el producto no se reconoce o no aplica para SP
 *   (caso CONTADOR).
 */
export const resolveProductFamily = (
  producto: string | null | undefined,
  pais: string | null | undefined,
): ProductFamily | null => {
  if (!producto) return null;
  const norm = normalizeSku(producto);
  if (!norm) return null;

  // Aliases directos (los que ya vienen normalizados desde Databricks)
  if (norm === 'fe') return 'FE';
  if (norm === 'nube') return 'NUBE';
  if (norm === 'contador') return 'CONTADOR';

  const country = (pais || '').toUpperCase() as CountryCode;
  const idx = FAMILY_INDEX[country];
  if (!idx) return null;
  return idx.get(norm) ?? null;
};

/** Devuelve los SKUs disponibles para un país y, opcionalmente, una familia. */
export const getSkusForCountry = (
  pais: CountryCode | string,
  family?: ProductFamily,
): string[] => {
  const country = (pais || '').toUpperCase() as CountryCode;
  const fam = PRODUCT_FAMILIES_BY_COUNTRY[country];
  if (!fam) return [];
  if (!family) return [...fam.FE, ...fam.NUBE, ...(fam.CONTADOR || [])];
  if (family === 'CONTADOR') return fam.CONTADOR ? [...fam.CONTADOR] : [];
  return [...fam[family]];
};

/** Familias disponibles para un país (MEX no tiene CONTADOR). */
export const getFamiliesForCountry = (pais: CountryCode | string): ProductFamily[] => {
  const country = (pais || '').toUpperCase() as CountryCode;
  const fam = PRODUCT_FAMILIES_BY_COUNTRY[country];
  if (!fam) return [];
  const out: ProductFamily[] = ['FE', 'NUBE'];
  if (fam.CONTADOR && fam.CONTADOR.length > 0) out.push('CONTADOR');
  return out;
};

/** Países soportados (orden canónico para selectores). */
export const SUPPORTED_COUNTRIES: CountryCode[] = ['COL', 'ECU', 'MEX', 'URU'];
