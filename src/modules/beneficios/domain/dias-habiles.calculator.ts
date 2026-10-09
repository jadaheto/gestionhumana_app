/**
 * Servicio de dominio puro: cálculo de días hábiles en Colombia.
 *
 * Replica `Vacaciones_model::calcular_dias_habiles` del sistema legado:
 * - Se cuentan de lunes a viernes.
 * - Se excluyen los festivos colombianos: fijos, los trasladables al lunes
 *   siguiente (Ley Emiliani, Ley 51 de 1983) y los que dependen de la Pascua.
 *
 * Todas las fechas se manejan como cadenas `YYYY-MM-DD` y la aritmética se
 * hace en UTC para evitar desfases por horario de verano/zona horaria.
 */

const DIA_MS = 86_400_000;

/** Festivos de fecha fija (no se trasladan). */
const FESTIVOS_FIJOS: ReadonlyArray<[number, number]> = [
  [1, 1], // Año Nuevo
  [5, 1], // Día del Trabajo
  [7, 20], // Independencia
  [8, 7], // Batalla de Boyacá
  [12, 8], // Inmaculada Concepción
  [12, 25], // Navidad
];

/** Festivos que se trasladan al lunes siguiente (Ley Emiliani). */
const FESTIVOS_EMILIANI: ReadonlyArray<[number, number]> = [
  [1, 6], // Reyes Magos
  [3, 19], // San José
  [6, 29], // San Pedro y San Pablo
  [8, 15], // Asunción de la Virgen
  [10, 12], // Día de la Raza
  [11, 1], // Todos los Santos
  [11, 11], // Independencia de Cartagena
];

export class DiasHabilesCalculator {
  private readonly cache = new Map<number, Set<string>>();

  /**
   * Cuenta los días hábiles (lunes a viernes no festivos) entre dos fechas,
   * ambas inclusive. Acepta `YYYY-MM-DD` o fecha-hora (se usa sólo la fecha).
   * Devuelve 0 si alguna fecha es inválida o si `fin` es anterior a `inicio`.
   */
  calcularDiasHabiles(fechaInicio: string | null | undefined, fechaFin: string | null | undefined): number {
    const inicio = parseIsoDate(fechaInicio);
    const fin = parseIsoDate(fechaFin);
    if (inicio === null || fin === null || fin < inicio) return 0;

    let dias = 0;
    for (let t = inicio; t <= fin; t += DIA_MS) {
      const d = new Date(t);
      const diaSemana = d.getUTCDay(); // 0 = domingo … 6 = sábado
      if (diaSemana === 0 || diaSemana === 6) continue;
      if (this.festivos(d.getUTCFullYear()).has(toIso(t))) continue;
      dias++;
    }
    return dias;
  }

  /** ¿Es un día hábil? (lunes a viernes y no festivo). */
  esDiaHabil(fecha: string): boolean {
    return this.calcularDiasHabiles(fecha, fecha) === 1;
  }

  /** Conjunto de festivos (`YYYY-MM-DD`) del año indicado. */
  festivos(year: number): Set<string> {
    let set = this.cache.get(year);
    if (!set) {
      set = DiasHabilesCalculator.festivosColombia(year);
      this.cache.set(year, set);
    }
    return set;
  }

  /** Festivos colombianos del año (equivale a `get_holidays_colombia`). */
  static festivosColombia(year: number): Set<string> {
    const set = new Set<string>();
    for (const [m, d] of FESTIVOS_FIJOS) set.add(toIso(Date.UTC(year, m - 1, d)));
    for (const [m, d] of FESTIVOS_EMILIANI) set.add(toIso(moverALunes(Date.UTC(year, m - 1, d))));

    const pascua = DiasHabilesCalculator.domingoDePascua(year);
    set.add(toIso(pascua - 3 * DIA_MS)); // Jueves Santo
    set.add(toIso(pascua - 2 * DIA_MS)); // Viernes Santo
    set.add(toIso(moverALunes(pascua + 43 * DIA_MS))); // Ascensión del Señor
    set.add(toIso(moverALunes(pascua + 64 * DIA_MS))); // Corpus Christi
    set.add(toIso(moverALunes(pascua + 71 * DIA_MS))); // Sagrado Corazón
    return set;
  }

  /**
   * Domingo de Pascua (calendario gregoriano) como timestamp UTC a medianoche.
   * Algoritmo anónimo gregoriano (Meeus/Jones/Butcher), equivalente a `easter_date()` de PHP.
   */
  static domingoDePascua(year: number): number {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(year, month - 1, day);
  }

  /** Fecha del domingo de Pascua en `YYYY-MM-DD`. */
  static pascua(year: number): string {
    return toIso(DiasHabilesCalculator.domingoDePascua(year));
  }
}

/** Si la fecha no cae en lunes, la traslada al lunes siguiente (Ley Emiliani). */
function moverALunes(t: number): number {
  const dia = new Date(t).getUTCDay(); // 0 domingo … 1 lunes … 6 sábado
  if (dia === 1) return t;
  const isoWeekday = dia === 0 ? 7 : dia; // 1 lunes … 7 domingo
  return t + (8 - isoWeekday) * DIA_MS;
}

/** Convierte `YYYY-MM-DD` (o fecha-hora que empiece así) a timestamp UTC de medianoche. */
export function parseIsoDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return t;
}

export function toIso(t: number): string {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Suma días calendario a una fecha `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const t = parseIsoDate(fecha);
  if (t === null) return fecha;
  return toIso(t + dias * DIA_MS);
}
