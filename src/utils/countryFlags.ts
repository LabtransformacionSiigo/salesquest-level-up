// Country code to flag emoji mapping for supported Siigo countries
const countryFlags: Record<string, string> = {
  'Colombia': '🇨🇴',
  'México': '🇲🇽',
  'Mexico': '🇲🇽',
  'Ecuador': '🇪🇨',
  'Perú': '🇵🇪',
  'Peru': '🇵🇪',
  'Chile': '🇨🇱',
  'Uruguay': '🇺🇾',
};

export const getCountryFlag = (country: string | null | undefined): string => {
  if (!country) return '';
  return countryFlags[country] || '';
};

export const SUPPORTED_COUNTRIES = [
  'Colombia',
  'México',
  'Ecuador',
  'Perú',
  'Chile',
  'Uruguay',
];
