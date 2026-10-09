export const ESTADOS_ASISTENCIA = [
  'normal',
  'tarde',
  'salida_temprana',
  'tarde_salida_temprana',
  'falla',
  'justificado',
] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

/** Fila consolidada de `asistencia_resumen_diario`. */
export interface ResumenDiario {
  id: number | null;
  userId: number;
  sedeId: number;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `HH:mm:ss` */
  horaEntrada: string | null;
  horaSalida: string | null;
  minutosTarde: number;
  minutosSalidaTemprana: number;
  estado: EstadoAsistencia;
  justificacion: string | null;
  detalle: string | null;
  memoEnviado: boolean;
  memoEnviadoAt: Date | null;
  memoError: string | null;
}

/** Resumen con los datos del colaborador necesarios para listados y memorandos. */
export interface ResumenConColaborador extends ResumenDiario {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  cedula: string | null;
}

/** Registro de la tabla heredada `asistencia` (registros manuales/externos). */
export interface RegistroAsistencia {
  id: number;
  userId: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  tipo: string;
  observacion: string | null;
  fuente: string;
}
