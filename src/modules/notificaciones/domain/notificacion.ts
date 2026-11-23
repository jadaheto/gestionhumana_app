import { ValidationError } from '../../../shared/domain/domain-error';

export interface NotificacionProps {
  id: number | null;
  userId: number;
  titulo: string;
  mensaje: string | null;
  /** info, permiso, tarea, cumpleanos, contrato, solicitud, comunicado… */
  tipo: string;
  leida: boolean;
  link: string | null;
  createdAt: Date;
}

/** Notificación interna de un usuario (tabla `notificaciones`). */
export class Notificacion {
  private constructor(readonly props: NotificacionProps) {}

  static create(
    props: Omit<NotificacionProps, 'id' | 'tipo' | 'leida' | 'link' | 'mensaje'> & {
      id?: number | null;
      tipo?: string | null;
      leida?: boolean;
      link?: string | null;
      mensaje?: string | null;
    },
  ): Notificacion {
    const titulo = (props.titulo ?? '').trim();
    if (titulo === '') throw new ValidationError('El título de la notificación es obligatorio.');
    if (titulo.length > 200) throw new ValidationError('El título no puede superar 200 caracteres.');
    return new Notificacion({
      id: props.id ?? null,
      userId: props.userId,
      titulo,
      mensaje: props.mensaje?.trim() || null,
      tipo: props.tipo?.trim() || 'info',
      leida: props.leida ?? false,
      link: props.link?.trim() || null,
      createdAt: props.createdAt,
    });
  }

  get id() {
    return this.props.id;
  }
  get leida() {
    return this.props.leida;
  }

  withId(id: number): Notificacion {
    return new Notificacion({ ...this.props, id });
  }
}
