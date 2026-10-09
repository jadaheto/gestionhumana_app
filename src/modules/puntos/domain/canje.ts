import { InvalidOperationError, ValidationError } from '../../../shared/domain/domain-error';

export const ESTADOS_CANJE = ['pendiente', 'aprobado', 'rechazado', 'usado'] as const;
export type EstadoCanje = (typeof ESTADOS_CANJE)[number];

export interface CanjeProps {
  id: number | null;
  userId: number;
  recompensaId: number;
  puntosUsados: number;
  estado: EstadoCanje;
  aprobadoPor: number | null;
  fechaUso: string | null;
  createdAt: Date;
}

/**
 * Solicitud de canje de una recompensa (tabla `canjes`).
 * Nace `pendiente`; un administrador la aprueba o la rechaza una única vez.
 */
export class Canje {
  private constructor(readonly props: CanjeProps) {}

  static create(
    props: Omit<CanjeProps, 'id' | 'estado' | 'aprobadoPor' | 'fechaUso'> & {
      id?: number | null;
      estado?: string | null;
      aprobadoPor?: number | null;
      fechaUso?: string | null;
    },
  ): Canje {
    if (!Number.isInteger(props.puntosUsados) || props.puntosUsados <= 0) {
      throw new ValidationError('Los puntos del canje deben ser un entero mayor que cero.');
    }
    const estado = (ESTADOS_CANJE as readonly string[]).includes(props.estado ?? '')
      ? (props.estado as EstadoCanje)
      : 'pendiente';
    return new Canje({
      id: props.id ?? null,
      userId: props.userId,
      recompensaId: props.recompensaId,
      puntosUsados: props.puntosUsados,
      estado,
      aprobadoPor: props.aprobadoPor ?? null,
      fechaUso: props.fechaUso ?? null,
      createdAt: props.createdAt,
    });
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get puntosUsados() {
    return this.props.puntosUsados;
  }
  get estado() {
    return this.props.estado;
  }
  get pendiente(): boolean {
    return this.props.estado === 'pendiente';
  }

  aprobar(adminId: number): Canje {
    this.assertPendiente();
    return new Canje({ ...this.props, estado: 'aprobado', aprobadoPor: adminId });
  }

  rechazar(adminId: number): Canje {
    this.assertPendiente();
    return new Canje({ ...this.props, estado: 'rechazado', aprobadoPor: adminId });
  }

  withId(id: number): Canje {
    return new Canje({ ...this.props, id });
  }

  private assertPendiente(): void {
    if (!this.pendiente) throw new InvalidOperationError('Este canje ya había sido procesado.');
  }
}
