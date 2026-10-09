/** Puerto de reloj: permite controlar el tiempo en los tests. */
export abstract class Clock {
  abstract now(): Date;

  /** Fecha de hoy en formato YYYY-MM-DD (zona local del servidor). */
  today(): string {
    return toIsoDate(this.now());
  }
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
