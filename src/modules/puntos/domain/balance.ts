import { ValidationError } from '../../../shared/domain/domain-error';

export interface BalanceProps {
  userId: number;
  puntosActuales: number;
  puntosTotalesGanados: number;
  puntosTotalesCanjeados: number;
  updatedAt: Date | null;
}

/**
 * Saldo de puntos de un colaborador (tabla `puntos`, una fila por usuario).
 * Se crea automáticamente en cero la primera vez que se consulta.
 */
export class Balance {
  private constructor(readonly props: BalanceProps) {}

  static create(props: Partial<BalanceProps> & { userId: number }): Balance {
    if (!Number.isInteger(props.userId) || props.userId <= 0) {
      throw new ValidationError('El usuario del balance es inválido.');
    }
    return new Balance({
      userId: props.userId,
      puntosActuales: props.puntosActuales ?? 0,
      puntosTotalesGanados: props.puntosTotalesGanados ?? 0,
      puntosTotalesCanjeados: props.puntosTotalesCanjeados ?? 0,
      updatedAt: props.updatedAt ?? null,
    });
  }

  static vacio(userId: number): Balance {
    return Balance.create({ userId });
  }

  get userId() {
    return this.props.userId;
  }
  get puntosActuales() {
    return this.props.puntosActuales;
  }

  /** ¿Alcanza el saldo para cubrir `cantidad` puntos? */
  alcanzaPara(cantidad: number): boolean {
    return this.props.puntosActuales >= cantidad;
  }
}
