import { Actor } from '../../../../shared/domain/actor';

/** Archivo recibido por HTTP (multer en memoria) y pasado al caso de uso. */
export interface ArchivoSubido {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// ---------- Solicitudes (permisos) ----------

export interface PermisoDto {
  id: number;
  userId: number;
  tipoPermiso: string;
  fechaSolicitud: string | null;
  /** `YYYY-MM-DD HH:mm:ss` */
  fechaInicio: string;
  fechaFin: string;
  horas: number | null;
  justificacion: string;
  /** Ruta relativa en `uploads/` (p. ej. `soportes/abc.pdf`) o null. */
  archivoSoporte: string | null;
  estado: string;
  aprobadoPor: number | null;
  observacionRespuesta: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Días hábiles del rango (sólo informativo; relevante para vacaciones). */
  diasHabiles: number;
  /** Nombre del colaborador (listados de administración). */
  colaborador: string | null;
  /** Nombre de quien aprobó/rechazó (listados de administración). */
  aprobador: string | null;
}

export interface CrearSolicitudInput {
  actor: Actor;
  tipoPermiso: string;
  fechaInicio: string;
  fechaFin: string;
  horas?: number | null;
  justificacion: string;
  archivo?: ArchivoSubido | null;
}

export interface ResolverSolicitudInput {
  actor: Actor;
  permisoId: number;
  observacion?: string | null;
}

export interface SuspenderVacacionesInput {
  actor: Actor;
  permisoId: number;
  diasDisfrutados: number;
  motivo?: string | null;
}

export interface SuspensionVacacionesDto {
  id: number;
  permisoId: number;
  userId: number;
  diasTotales: number;
  diasDisfrutados: number;
  diasReintegrados: number;
  motivo: string | null;
  suspendidoPor: number;
  fechaSuspension: string;
  /** Rango original de la solicitud suspendida. */
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface SuspenderVacacionesResultado extends SuspensionVacacionesDto {
  message: string;
}

// ---------- Vacaciones ----------

export interface SaldoVacacionesDto {
  periodos: number;
  diasAcumulados: number;
  diasConsumidos: number;
  diasPendientes: number;
}

/** Resumen para la pantalla "Vacaciones pendientes" de Mi puesto. */
export interface ResumenVacacionesDto {
  userId: number;
  fechaReferencia: string | null;
  saldo: SaldoVacacionesDto;
  solicitudes: PermisoDto[];
  suspensiones: SuspensionVacacionesDto[];
}

export interface VacacionDto {
  id: number;
  userId: number;
  periodo: string;
  diasTotales: number;
  diasTomados: number;
  diasPendientes: number;
  estado: string;
  createdAt: string | null;
  colaborador: string | null;
}

// ---------- Incapacidades ----------

export interface IncapacidadDto {
  id: number;
  userId: number;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  entidadEmisora: string | null;
  numeroIncapacidad: string | null;
  archivoSoporte: string | null;
  estado: string;
  createdAt: string | null;
  colaborador: string | null;
}

export interface RegistrarIncapacidadInput {
  actor: Actor;
  /** Sólo lo respeta el administrador; el funcionario registra sobre sí mismo. */
  userId?: number | null;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  dias?: number | null;
  entidadEmisora?: string | null;
  numeroIncapacidad?: string | null;
  archivo?: ArchivoSubido | null;
}

// ---------- Colaboradores (select) ----------

export interface ColaboradorDto {
  id: number;
  nombre: string;
  cedula: string | null;
}
