export type VnLeaderCandidate = {
  id?: string;
  nombre?: string | null;
  email?: string | null;
  celula?: string | null;
  canal?: string | null;
  pais?: string | null;
  user_id?: string | null;
  sp_canje?: number | null;
  sp_convencion?: number | null;
};

export const isVnChannel = (canal?: string | null) =>
  canal === 'VN_ALIADOS' || canal === 'VN_EMPRESARIOS';

export const normalizeVnLeaderText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9@._\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const significantWords = (value: unknown) =>
  normalizeVnLeaderText(value)
    .split(/[\s._-]+/)
    .filter((word) => word.length >= 3 && !['equipo', 'mexico', 'colombia', 'ecuador', 'uruguay'].includes(word));

export const getVnLeaderTokenFromCelula = (celula?: string | null) => {
  const words = significantWords(celula);
  return words[words.length - 1] || '';
};

const hasPersonMatch = (candidateName: string, expectedName: string) => {
  if (!candidateName || !expectedName) return false;
  if (candidateName === expectedName || candidateName.includes(expectedName) || expectedName.includes(candidateName)) return true;
  const candidateWords = new Set(significantWords(candidateName));
  const expectedWords = significantWords(expectedName);
  return expectedWords.filter((word) => candidateWords.has(word)).length >= 2;
};

export const scoreVnLeaderCandidate = (
  candidate: VnLeaderCandidate,
  options: { celula?: string | null; gerenteNombre?: string | null; advisorNames?: Set<string> } = {},
) => {
  const name = normalizeVnLeaderText(candidate.nombre);
  const email = normalizeVnLeaderText(candidate.email);
  const emailPrefix = email.split('@')[0] || '';
  const token = getVnLeaderTokenFromCelula(options.celula ?? candidate.celula);
  const gerenteNombre = normalizeVnLeaderText(options.gerenteNombre);
  const firstName = significantWords(name)[0] || '';
  let score = 0;

  if (gerenteNombre && hasPersonMatch(name, gerenteNombre)) score += 1000;
  if (token) {
    if (name.includes(token) || emailPrefix.includes(token)) score += 300;
    if (firstName && (firstName === token || token.startsWith(firstName) || firstName.startsWith(token))) score += 240;
  }
  if (candidate.user_id) score += 25;
  if ((Number(candidate.sp_canje) || 0) > 0) score += 20;
  if (emailPrefix.startsWith('emp-')) score -= 500;
  if (options.advisorNames?.has(name)) score -= 300;
  return score;
};

export const pickVnLeaderCandidate = <T extends VnLeaderCandidate>(
  candidates: T[],
  options: { celula?: string | null; gerenteNombre?: string | null; advisorNames?: Set<string>; excludeIds?: Set<string> } = {},
) => {
  const pool = candidates.filter((candidate) => !options.excludeIds?.has(String(candidate.id || '')));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => scoreVnLeaderCandidate(b, options) - scoreVnLeaderCandidate(a, options))[0];
};