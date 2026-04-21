// Niveles de progresión por canal.
// VC tiene una escala más corta basada en el ciclo 2026 (Cuarzo→Diamante 0→1.001+).
// Otros canales mantienen la escala histórica (0→6.001+).

export interface Nivel {
  nombre: string;
  emoji: string;
  min: number;
  max: number;
}

export const NIVELES_VC: Nivel[] = [
  { nombre: 'Cuarzo', emoji: '🪨', min: 0, max: 150 },
  { nombre: 'Rubí', emoji: '❤️‍🔥', min: 151, max: 380 },
  { nombre: 'Zafiro', emoji: '💎', min: 381, max: 700 },
  { nombre: 'Esmeralda', emoji: '🟢', min: 701, max: 1000 },
  { nombre: 'Diamante', emoji: '💠', min: 1001, max: Number.MAX_SAFE_INTEGER },
];

export const NIVELES_DEFAULT: Nivel[] = [
  { nombre: 'Cuarzo', emoji: '🪨', min: 0, max: 1500 },
  { nombre: 'Rubí', emoji: '❤️‍🔥', min: 1501, max: 3000 },
  { nombre: 'Zafiro', emoji: '💎', min: 3001, max: 4500 },
  { nombre: 'Esmeralda', emoji: '🟢', min: 4501, max: 6000 },
  { nombre: 'Diamante', emoji: '💠', min: 6001, max: Number.MAX_SAFE_INTEGER },
];

export const getNivelesByCanal = (canal?: string | null): Nivel[] =>
  canal === 'VC' ? NIVELES_VC : NIVELES_DEFAULT;

export const getNivelThresholds = (canal?: string | null): number[] =>
  getNivelesByCanal(canal).map((n) => n.min);

export const getNivelData = (spTotales: number, canal?: string | null) => {
  const niveles = getNivelesByCanal(canal);
  const nivelActual = niveles.find((nivel) => spTotales >= nivel.min && spTotales <= nivel.max) || niveles[0];
  const siguienteNivel = niveles[niveles.indexOf(nivelActual) + 1] ?? null;

  return {
    nivel: nivelActual.nombre,
    sp_nivel_actual: Math.max(0, spTotales - nivelActual.min),
    sp_siguiente_nivel: siguienteNivel?.min ?? null,
  };
};
