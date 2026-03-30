export interface ProductBreakdownItem {
  label: string;
  value: number;
  units?: number;
}

const normalizeProductLabel = (label?: string | null) =>
  (label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const aggregateProductBreakdown = <T extends ProductBreakdownItem>(items: T[]) => {
  const grouped = new Map<string, ProductBreakdownItem>();

  for (const item of items || []) {
    const normalizedLabel = normalizeProductLabel(item.label);
    if (!normalizedLabel) continue;

    const existing = grouped.get(normalizedLabel);
    if (existing) {
      existing.value += Number(item.value) || 0;
      existing.units = (existing.units || 0) + (Number(item.units) || 0);
      continue;
    }

    grouped.set(normalizedLabel, {
      label: item.label.trim(),
      value: Number(item.value) || 0,
      units: Number(item.units) || 0,
    });
  }

  return [...grouped.values()]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
};