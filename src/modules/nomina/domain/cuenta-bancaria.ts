import { ValidationError } from '../../../shared/domain/domain-error';

export const TIPOS_CUENTA = ['ahorros', 'corriente'] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];

export interface CuentaBancariaProps {
  id: number | null;
  userId: number;
  banco: string;
  tipoCuenta: TipoCuenta;
  numeroCuenta: string;
  createdAt: Date | null;
}

/** Cuenta bancaria registrada por el propio colaborador (tabla `cuentas_bancarias`). */
export class CuentaBancaria {
  private constructor(readonly props: CuentaBancariaProps) {}

  static create(
    props: Omit<CuentaBancariaProps, 'id' | 'createdAt'> & { id?: number | null; createdAt?: Date | null },
  ): CuentaBancaria {
    const banco = (props.banco ?? '').trim();
    if (banco === '') throw new ValidationError('El banco es obligatorio.');
    if (banco.length > 100) throw new ValidationError('El nombre del banco no puede superar 100 caracteres.');
    if (!(TIPOS_CUENTA as readonly string[]).includes(props.tipoCuenta)) {
      throw new ValidationError('El tipo de cuenta debe ser "ahorros" o "corriente".');
    }
    const numero = (props.numeroCuenta ?? '').replace(/\s+/g, '');
    if (numero === '') throw new ValidationError('El número de cuenta es obligatorio.');
    if (!/^[0-9A-Za-z-]{4,30}$/.test(numero)) {
      throw new ValidationError('El número de cuenta debe tener entre 4 y 30 caracteres alfanuméricos.');
    }
    if (!Number.isInteger(props.userId) || props.userId <= 0) throw new ValidationError('Usuario inválido.');
    return new CuentaBancaria({
      id: props.id ?? null,
      userId: props.userId,
      banco,
      tipoCuenta: props.tipoCuenta,
      numeroCuenta: numero,
      createdAt: props.createdAt ?? null,
    });
  }

  get id(): number | null {
    return this.props.id;
  }

  withId(id: number): CuentaBancaria {
    return new CuentaBancaria({ ...this.props, id });
  }
}
