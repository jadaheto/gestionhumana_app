import { toIsoDate } from '../../../shared/application/ports/clock.port';

/** Fecha-hora local `YYYY-MM-DD HH:mm:ss` (formato de las columnas TIMESTAMP). */
export function toTimestamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${toIsoDate(d)} ${hh}:${mi}:${ss}`;
}
