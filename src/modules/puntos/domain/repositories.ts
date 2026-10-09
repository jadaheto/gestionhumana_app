import { Balance } from './balance';
import { Canje, EstadoCanje } from './canje';
import { Recompensa } from './recompensa';
import { Transaccion } from './transaccion';

export abstract class BalanceRepository {
  abstract findByUserId(userId: number): Promise<Balance | null>;
  /** Crea la fila de saldo en cero para el usuario. */
  abstract create(userId: number): Promise<Balance>;
  /** Suma `cantidad` a los puntos actuales y a los totales ganados (operación atómica). */
  abstract acreditar(userId: number, cantidad: number): Promise<void>;
  /**
   * Resta `cantidad` de los puntos actuales y la suma a los totales canjeados,
   * sólo si el saldo es suficiente. Devuelve `false` si no se descontó.
   */
  abstract descontar(userId: number, cantidad: number): Promise<boolean>;
  /** Devuelve `cantidad` a los puntos actuales y la resta de los totales canjeados. */
  abstract reintegrar(userId: number, cantidad: number): Promise<void>;
}

export abstract class TransaccionRepository {
  abstract findByUserId(userId: number, limit?: number): Promise<Transaccion[]>;
  abstract save(transaccion: Transaccion): Promise<Transaccion>;
}

export abstract class RecompensaRepository {
  abstract findActivas(): Promise<Recompensa[]>;
  abstract findById(id: number): Promise<Recompensa | null>;
}

/** Canje enriquecido con nombres para los listados (modelo de lectura). */
export interface CanjeConDetalle {
  canje: Canje;
  colaboradorNombre: string;
  recompensaNombre: string;
  aprobadoPorNombre: string | null;
}

export abstract class CanjeRepository {
  abstract findById(id: number): Promise<Canje | null>;
  abstract findDetalleById(id: number): Promise<CanjeConDetalle | null>;
  /** Canjes con detalle; `estado` nulo = todos. Pendientes primero (más antiguos primero), el resto por fecha descendente. */
  abstract findConDetalle(filtro: { estado?: EstadoCanje | null; userId?: number | null }): Promise<CanjeConDetalle[]>;
  abstract save(canje: Canje): Promise<Canje>;
}

/** Conjunto de repositorios que participan en una misma transacción de BD. */
export interface PuntosRepositories {
  balances: BalanceRepository;
  transacciones: TransaccionRepository;
  recompensas: RecompensaRepository;
  canjes: CanjeRepository;
}

/**
 * Unidad de trabajo: ejecuta `work` dentro de una transacción de base de datos.
 * Si `work` lanza, la transacción se revierte. Los casos de uso que mueven
 * puntos (canjear, asignar, resolver canje) la usan para garantizar atomicidad.
 */
export abstract class PuntosUnitOfWork {
  abstract run<T>(work: (repos: PuntosRepositories) => Promise<T>): Promise<T>;
}
