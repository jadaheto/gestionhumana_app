import { Notificacion } from './notificacion';

export abstract class NotificacionRepository {
  /** Últimas `limit` notificaciones del usuario (más recientes primero). `soloNoLeidas` filtra las pendientes. */
  abstract findRecientes(userId: number, limit: number, soloNoLeidas?: boolean): Promise<Notificacion[]>;
  abstract countNoLeidas(userId: number): Promise<number>;
  /** Marca como leída sólo si pertenece al usuario. Devuelve `false` si no existía. */
  abstract marcarLeida(id: number, userId: number): Promise<boolean>;
  /** Devuelve cuántas notificaciones se marcaron. */
  abstract marcarTodasLeidas(userId: number): Promise<number>;
  /** Elimina sólo si pertenece al usuario. Devuelve `false` si no existía. */
  abstract eliminar(id: number, userId: number): Promise<boolean>;
  abstract save(notificacion: Notificacion): Promise<Notificacion>;
}
