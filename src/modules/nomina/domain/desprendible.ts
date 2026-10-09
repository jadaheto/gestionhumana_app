/** Mapa concepto → valor (p. ej. `"Salario - 001": 1232414`). */
export type ConceptosNomina = Record<string, number>;

/**
 * Desprendible de nómina de un colaborador (tabla `desprendibles_nomina`).
 * Se alimenta principalmente desde la importación del PDF de liquidación.
 */
export interface Desprendible {
  id: number;
  userId: number;
  periodo: string;
  salarioBasico: number;
  devengados: ConceptosNomina;
  deducciones: ConceptosNomina;
  totalDevengado: number;
  totalDeducido: number;
  netoPagar: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaLiquidacion: string | null;
  nroComprobante: string | null;
  banco: string | null;
  numeroCuenta: string | null;
  archivoPdf: string | null;
  createdAt: Date | null;
}

/** Convierte el valor JSONB/texto de la BD en un mapa de conceptos. */
export function toConceptos(value: unknown): ConceptosNomina {
  let obj: unknown = value;
  if (typeof value === 'string') {
    try {
      obj = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: ConceptosNomina = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export function sumarConceptos(c: ConceptosNomina): number {
  return Object.values(c).reduce((acc, v) => acc + v, 0);
}

/** Año al que pertenece el desprendible (por fecha fin, luego fecha inicio, luego clave de período). */
export function anioDesprendible(d: Pick<Desprendible, 'fechaFin' | 'fechaInicio' | 'periodo'>): number | null {
  const fuente = d.fechaFin ?? d.fechaInicio ?? d.periodo;
  const m = /^(\d{4})/.exec(fuente ?? '');
  return m ? Number(m[1]) : null;
}
