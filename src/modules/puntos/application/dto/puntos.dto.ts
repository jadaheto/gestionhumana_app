import { EstadoCanje } from '../../domain/canje';
import { TipoTransaccion } from '../../domain/transaccion';

export interface BalanceDto {
  userId: number;
  puntosActuales: number;
  puntosTotalesGanados: number;
  puntosTotalesCanjeados: number;
  updatedAt: string | null;
}

export interface TransaccionDto {
  id: number;
  userId: number;
  tipo: TipoTransaccion;
  cantidad: number;
  concepto: string;
  referenciaId: number | null;
  /** Timestamp ISO. */
  createdAt: string;
}

export interface RecompensaDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  puntosRequeridos: number;
  tipo: string;
  icono: string;
  estado: string;
}

export interface CanjeDto {
  id: number;
  userId: number;
  colaboradorNombre: string;
  recompensaId: number;
  recompensaNombre: string;
  puntosUsados: number;
  estado: EstadoCanje;
  aprobadoPor: number | null;
  aprobadoPorNombre: string | null;
  fechaUso: string | null;
  createdAt: string;
}

export interface ColaboradorResumenDto {
  id: number;
  nombre: string;
  cedula: string | null;
  cargoNombre: string | null;
}

export interface AsignarPuntosInput {
  userId: number;
  cantidad: number;
  concepto: string;
}
