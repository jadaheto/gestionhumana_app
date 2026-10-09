/**
 * Puerto de lectura del dashboard. Agrupa las consultas de `Rrhh_model` y las
 * necesarias para el saldo de vacaciones (`Vacaciones_model::get_saldo_resumen`).
 * Se implementa en infraestructura con SQL parametrizado; en tests se sustituye
 * por un doble en memoria.
 */
export interface PersonaResumen {
  id: number;
  nombre: string;
  profileImage: string | null;
  cargoNombre: string | null;
  areaNombre: string | null;
}

export interface CumpleaneroRow extends PersonaResumen {
  fechaNacimiento: string;
}

export interface AniversarioRow extends PersonaResumen {
  fechaReferencia: string;
  anios: number;
}

export interface ContratoPorVencerRow {
  id: number;
  userId: number;
  nombre: string;
  profileImage: string | null;
  tipoContrato: string;
  numeroContrato: string;
  fechaFin: string;
}

export interface TopPuntoRow {
  userId: number;
  nombre: string;
  profileImage: string | null;
  puntosActuales: number;
  puntosTotalesGanados: number;
}

export interface DistribucionRow {
  nombre: string;
  total: number;
}

export interface PerfilRow {
  id: number;
  nombre: string;
  profileImage: string | null;
  cargoNombre: string | null;
  areaNombre: string | null;
  /** Fecha de ingreso de referencia (contrato activo → último contrato → users.fecha_ingreso). */
  fechaIngreso: string | null;
}

/** Vacaciones aprobadas del usuario con su posible suspensión. */
export interface VacacionAprobadaRow {
  permisoId: number;
  fechaInicio: string;
  fechaFin: string;
  /** Días efectivamente disfrutados si la vacación fue suspendida; null si no. */
  diasDisfrutadosSuspension: number | null;
}

export abstract class DashboardQueries {
  // --- Administrador ---
  abstract countColaboradores(estado?: 'activo' | 'inactivo'): Promise<number>;
  abstract countPermisosPendientes(): Promise<number>;
  abstract contratosPorVencer(hoy: string, dias: number, limite: number): Promise<ContratoPorVencerRow[]>;
  abstract topPuntos(limite: number): Promise<TopPuntoRow[]>;
  abstract colaboradoresPorArea(): Promise<DistribucionRow[]>;
  abstract colaboradoresPorSede(): Promise<DistribucionRow[]>;
  // --- Comunes ---
  abstract cumpleanerosHoy(hoy: string): Promise<CumpleaneroRow[]>;
  abstract aniversariosHoy(hoy: string): Promise<AniversarioRow[]>;
  // --- Funcionario ---
  abstract perfilUsuario(userId: number): Promise<PerfilRow | null>;
  abstract countMisPermisos(userId: number, estado?: 'pendiente'): Promise<number>;
  abstract vacacionesAprobadas(userId: number): Promise<VacacionAprobadaRow[]>;
}
