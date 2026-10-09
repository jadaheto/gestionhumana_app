/** Resumen de un colaborador para selects y listados (contexto de usuarios). */
export interface ColaboradorResumen {
  id: number;
  nombre: string;
  cedula: string | null;
  cargoNombre: string | null;
}

/**
 * Puerto hacia el contexto de usuarios/colaboradores. Se define aquí para que
 * Puntos no dependa del módulo de colaboradores; se implementa en infraestructura.
 */
export abstract class ColaboradorDirectory {
  /** Colaboradores activos (excluye administradores), ordenados por nombre. */
  abstract listActivos(): Promise<ColaboradorResumen[]>;
  abstract findById(userId: number): Promise<ColaboradorResumen | null>;
}

export interface NuevaNotificacion {
  userId: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  link: string | null;
}

/**
 * Puerto hacia el contexto de notificaciones: publica una notificación
 * para un usuario (inserción directa en la tabla `notificaciones`).
 */
export abstract class NotificacionPublisher {
  abstract publicar(notificacion: NuevaNotificacion): Promise<void>;
}
