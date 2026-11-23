export interface NuevaNotificacion {
  userId: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'tarea' | 'permiso' | 'cumpleanos' | 'contrato';
  link: string | null;
}

/** Puerto para crear notificaciones en la tabla `notificaciones` (gestionada por otro contexto). */
export abstract class NotificacionesPort {
  abstract crear(notificacion: NuevaNotificacion, now: string): Promise<void>;
}
