import { ValidationError } from '../../../shared/domain/domain-error';

/**
 * Tipos de movimiento (columna `puntos_transacciones.tipo`).
 * - `ganado`: puntos asignados por un administrador.
 * - `canjeado`: puntos descontados al solicitar un canje.
 * - `reintegro`: puntos devueltos cuando un canje es rechazado.
 */
export const TIPOS_TRANSACCION = ['ganado', 'canjeado', 'reintegro'] as const;
export type TipoTransaccion = (typeof TIPOS_TRANSACCION)[number];

export interface TransaccionProps {
  id: number | null;
  userId: number;
  tipo: TipoTransaccion;
  cantidad: number;
  concepto: string;
  referenciaId: number | null;
  createdAt: Date;
}

export class Transaccion {
  private constructor(readonly props: TransaccionProps) {}

  static create(props: Omit<TransaccionProps, 'id'> & { id?: number | null }): Transaccion {
    if (!Number.isInteger(props.cantidad) || props.cantidad <= 0) {
      throw new ValidationError('La cantidad de puntos debe ser un entero mayor que cero.');
    }
    const concepto = (props.concepto ?? '').trim();
    if (concepto === '') throw new ValidationError('El concepto es obligatorio.');
    if (concepto.length > 255) throw new ValidationError('El concepto no puede superar 255 caracteres.');
    if (!TIPOS_TRANSACCION.includes(props.tipo)) throw new ValidationError('Tipo de transacción inválido.');
    return new Transaccion({
      id: props.id ?? null,
      userId: props.userId,
      tipo: props.tipo,
      cantidad: props.cantidad,
      concepto,
      referenciaId: props.referenciaId ?? null,
      createdAt: props.createdAt,
    });
  }

  get id() {
    return this.props.id;
  }

  /** Signo del movimiento sobre el saldo disponible. */
  get esIngreso(): boolean {
    return this.props.tipo !== 'canjeado';
  }

  withId(id: number): Transaccion {
    return new Transaccion({ ...this.props, id });
  }
}
