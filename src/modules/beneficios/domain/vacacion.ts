/**
 * Período de vacaciones registrado (tabla `vacaciones`). En el legado es un
 * registro de sólo lectura (`Beneficio_model::get_vacaciones`), por lo que se
 * modela como estructura inmutable sin reglas de creación.
 */
export interface Vacacion {
  id: number;
  userId: number;
  /** p. ej. "2025-2026" */
  periodo: string;
  diasTotales: number;
  diasTomados: number;
  diasPendientes: number;
  estado: string;
  createdAt: string | null;
}

/** Detalle de vacaciones tomadas dentro de un período (tabla `vacaciones_detalle`). */
export interface VacacionDetalle {
  id: number;
  vacacionId: number;
  userId: number;
  /** `YYYY-MM-DD` */
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  estado: string;
  aprobadoPor: number | null;
  observacion: string | null;
  createdAt: string | null;
}
