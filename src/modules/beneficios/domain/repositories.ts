import { Incapacidad } from './incapacidad';
import { Permiso } from './permiso';
import { Vacacion, VacacionDetalle } from './vacacion';
import { VacacionesSuspension } from './vacaciones-suspension';

/** Permiso enriquecido con los nombres del colaborador y del aprobador (listado admin). */
export interface PermisoConNombres {
  permiso: Permiso;
  colaborador: string;
  aprobador: string | null;
}

export interface FiltroPermisos {
  estado?: string | null;
}

export abstract class PermisoRepository {
  abstract findById(id: number): Promise<Permiso | null>;
  /** Solicitudes del usuario, más recientes primero. */
  abstract findByUser(userId: number): Promise<Permiso[]>;
  /** Todas las solicitudes con nombres (admin), más recientes primero. */
  abstract findAll(filtro?: FiltroPermisos): Promise<PermisoConNombres[]>;
  /** Vacaciones aprobadas del usuario (opcionalmente excluyendo una solicitud). */
  abstract findVacacionesAprobadas(userId: number, excluirPermisoId?: number | null): Promise<Permiso[]>;
  /** Todas las solicitudes de tipo vacaciones del usuario, más recientes primero. */
  abstract findVacacionesByUser(userId: number): Promise<Permiso[]>;
  abstract save(permiso: Permiso): Promise<Permiso>;
}

/** Suspensión junto con el rango original de la solicitud. */
export interface SuspensionConRango {
  suspension: VacacionesSuspension;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export abstract class VacacionesSuspensionRepository {
  abstract findByPermiso(permisoId: number): Promise<VacacionesSuspension | null>;
  /** Mapa permisoId → días disfrutados para los permisos indicados. */
  abstract findDiasDisfrutados(permisoIds: number[]): Promise<Map<number, number>>;
  /** Suspensiones del usuario, más recientes primero. */
  abstract findByUser(userId: number): Promise<SuspensionConRango[]>;
  abstract save(suspension: VacacionesSuspension): Promise<VacacionesSuspension>;
}

export interface IncapacidadConNombre {
  incapacidad: Incapacidad;
  colaborador: string;
}

export abstract class IncapacidadRepository {
  abstract findByUser(userId: number): Promise<Incapacidad[]>;
  abstract findAll(): Promise<IncapacidadConNombre[]>;
  abstract save(incapacidad: Incapacidad): Promise<Incapacidad>;
}

export interface VacacionConNombre {
  vacacion: Vacacion;
  colaborador: string;
}

export abstract class VacacionRepository {
  abstract findByUser(userId: number): Promise<Vacacion[]>;
  abstract findAll(): Promise<VacacionConNombre[]>;
  abstract findDetalles(vacacionIds: number[]): Promise<VacacionDetalle[]>;
}
