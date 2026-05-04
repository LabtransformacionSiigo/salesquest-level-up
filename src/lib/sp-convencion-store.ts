// Tiny global store to share the accumulated yearly SP Convención total
// computed in MiPerformance with the Header/Sidebar badges.
// The hook `useGamificationMetrics` only knows about the current month,
// so the page-level historial publishes the total here for the chrome to consume.

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
  if (totalSp === value) return;
  totalSp = value;
  listeners.forEach((l) => l());
};

export const getSpConvencionAnual = () => totalSp;

// Seed the store only if it hasn't been set yet (or is 0). Used by hooks that
// compute a baseline value early so they don't overwrite a more accurate value
// published later by MiPerformance.
export const seedSpConvencionAnual = (value: number | null) => {
  if (value == null || value <= 0) return;
  if (totalSp != null && totalSp > 0) return;
  totalSp = value;
  listeners.forEach((l) => l());
};

export const useSpConvencionAnual = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
