/**
 * Puertos hacia otros contextos (usuarios, contratos, notificaciones).
 * Se definen aquí para que el módulo no importe clases de otros módulos;
 * las implementaciones (SQL directo) viven en `infrastructure/`.
 */

export interface ColaboradorResumen {
  id: number;
  nombre: string;
  cedula: string | null;
}

export abstract class UsuariosPort {
  /** Ids de los administradores activos (destinatarios de notificaciones). */
  abstract findAdminsActivosIds(): Promise<number[]>;
  /**
   * Fecha de ingreso de referencia para vacaciones (`YYYY-MM-DD`):
   * contrato activo → último contrato → `users.fecha_ingreso`.
   */
  abstract findFechaIngresoReferencia(userId: number): Promise<string | null>;
  /** Colaboradores para selects (id, nombre completo, cédula). */
  abstract findColaboradores(): Promise<ColaboradorResumen[]>;
  abstract exists(userId: number): Promise<boolean>;
  /**
   * Jefe inmediato según el organigrama: responsable activo del área del colaborador; si no hay
   * (o es el propio colaborador), el de la dependencia superior, y así hacia arriba. Null si no existe.
   */
  abstract findJefeInmediatoId(userId: number): Promise<number | null>;
  /** El usuario es responsable de alguna área activa o tiene solicitudes asignadas como jefe inmediato. */
  abstract esJefe(userId: number): Promise<boolean>;
}

export interface NuevaNotificacion {
  userId: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  link: string | null;
}

export abstract class NotificacionesPort {
  abstract crear(notificacion: NuevaNotificacion): Promise<void>;
}
