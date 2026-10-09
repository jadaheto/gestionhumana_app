/**
 * Utilidades de fechas en formato `YYYY-MM-DD` (sin zona horaria).
 * Replican la semántica de `strtotime('+N months -1 day')` de PHP, que
 * normaliza los desbordes de mes (31 de enero + 1 mes = 3 de marzo).
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaIso(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = partes(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function aIso(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Suma (o resta) años, meses y días normalizando como PHP. */
export function sumar(iso: string, delta: { anios?: number; meses?: number; dias?: number }): string {
  const [y, m, d] = partes(iso);
  return aIso(new Date(Date.UTC(y + (delta.anios ?? 0), m - 1 + (delta.meses ?? 0), d + (delta.dias ?? 0))));
}

/** Días enteros entre dos fechas (`hasta - desde`); negativo si `hasta` es anterior. */
export function diferenciaDias(desde: string, hasta: string): number {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  return Math.floor((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-03-05` → `5 de marzo de 2026` (igual que `fecha_larga_es` del legado). */
export function fechaLargaEs(iso: string): string {
  if (!esFechaIso(iso)) return iso;
  const [y, m, d] = partes(iso);
  return `${d} de ${MESES_ES[m - 1]} de ${y}`;
}

const ORDINALES: Record<number, string> = { 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta' };

/** `1` → `primera`, `6` → `6ª` (igual que `ordinal_texto` del legado). */
export function ordinalTexto(n: number): string {
  return ORDINALES[n] ?? `${n}ª`;
}
