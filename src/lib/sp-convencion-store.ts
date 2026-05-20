// Store global para el total anual de SP Convención del usuario logueado.
// FUENTE ÚNICA: la columna `sp` de la tabla Historial Mensual
// (vcMonthlyCumplimiento en useGamificationMetrics). Quien escriba aquí
// debe usar esa misma suma — nunca un cálculo alterno.

import { useSyncExternalStore } from 'react';

let totalSp: number | null = null;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSnapshot = () => totalSp;
const getServerSnapshot = () => null;

export const setSpConvencionAnual = (value: number | null) => {
  // Sin guard de "no bajar": el último cálculo del Historial Mensual SIEMPRE
  // gana, porque es la única fuente válida.
  if (totalSp === value) return;
  totalSp = value;
  listeners.forEach((l) => l());
};

export const useSpConvencionAnual = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
