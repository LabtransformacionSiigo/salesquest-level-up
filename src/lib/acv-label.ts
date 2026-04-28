// Etiqueta de ACV dependiente del front.
// Para usuarios/contextos de Venta Cruzada (VC) se muestra como "ACV+".
// Para Venta Nueva y vistas administrativas/genéricas se mantiene "ACV".
export const isVcCanal = (canal?: string | null): boolean =>
  String(canal || '').toUpperCase() === 'VC';

export const acvLabel = (canal?: string | null): string =>
  isVcCanal(canal) ? 'ACV+' : 'ACV';

export const metaAcvLabel = (canal?: string | null): string =>
  isVcCanal(canal) ? 'Meta ACV+' : 'Meta ACV';

export const acvPctLabel = (canal?: string | null): string =>
  isVcCanal(canal) ? '% ACV+' : '% ACV';
