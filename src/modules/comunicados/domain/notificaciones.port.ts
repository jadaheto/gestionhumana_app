/** Notificación a crear para un conjunto de usuarios. */
export interface NotificacionNueva {
  titulo: string;
  mensaje: string;
  tipo: string;
  link: string | null;
}

/**
 * Puerto hacia el contexto de Notificaciones. El módulo no importa clases de
 * otros módulos: la implementación inserta en la tabla `notificaciones`.
 */
export abstract class NotificacionesPort {
  /** Crea la notificación para todos los colaboradores activos. Devuelve cuántas creó. */
  abstract notificarUsuariosActivos(notificacion: NotificacionNueva): Promise<number>;
}
