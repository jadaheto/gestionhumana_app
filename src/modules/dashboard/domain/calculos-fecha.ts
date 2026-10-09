/**
 * Utilidades de fechas `YYYY-MM-DD` sin zona horaria (se trabaja en UTC puro
 * para que los cálculos de días no dependan del servidor).
 */
const MS_DIA = 86_400_000;

export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Días calendario entre dos fechas (`hasta - desde`), negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  const a = parseIsoDate(desde);
  const b = parseIsoDate(hasta);
  if (!a || !b) return 0;
  return Math.floor((b.getTime() - a.getTime()) / MS_DIA);
}

/** Años completos cumplidos entre `desde` y `hasta` (equivale a `DateTime::diff()->y`). */
export function aniosCumplidos(desde: string, hasta: string): number {
  const a = parseIsoDate(desde);
  const b = parseIsoDate(hasta);
  if (!a || !b || b < a) return 0;
  let anios = b.getUTCFullYear() - a.getUTCFullYear();
  const antesDelAniversario =
    b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  if (antesDelAniversario) anios--;
  return Math.max(0, anios);
}

/**
 * Días hábiles (lunes a viernes) entre dos fechas inclusive.
 * APROXIMACIÓN: el legado además descuenta los festivos colombianos
 * (`Vacaciones_model::get_holidays_colombia`); ese calendario lo implementa el
 * módulo de vacaciones, por lo que en el dashboard el saldo puede diferir en
 * los festivos que caigan dentro de una vacación aprobada.
 */
export function diasHabilesAproximados(inicio: string, fin: string): number {
  const a = parseIsoDate(inicio);
  const b = parseIsoDate(fin);
  if (!a || !b || b < a) return 0;
  let dias = 0;
  for (let t = a.getTime(); t <= b.getTime(); t += MS_DIA) {
    const dow = new Date(t).getUTCDay(); // 0 = domingo, 6 = sábado
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
}
