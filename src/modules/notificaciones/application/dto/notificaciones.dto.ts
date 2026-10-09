export interface NotificacionDto {
  id: number;
  titulo: string;
  mensaje: string | null;
  tipo: string;
  leida: boolean;
  link: string | null;
  /** Timestamp ISO. */
  createdAt: string;
}

export interface ListaNotificacionesDto {
  /** Total de notificaciones no leídas del usuario (no sólo las devueltas). */
  noLeidas: number;
  items: NotificacionDto[];
}

export interface ContadorNoLeidasDto {
  noLeidas: number;
}
