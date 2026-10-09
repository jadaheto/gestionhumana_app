import { Balance } from '../domain/balance';
import { Recompensa } from '../domain/recompensa';
import { CanjeConDetalle } from '../domain/repositories';
import { Transaccion } from '../domain/transaccion';
import { BalanceDto, CanjeDto, RecompensaDto, TransaccionDto } from './dto/puntos.dto';

export function toBalanceDto(b: Balance): BalanceDto {
  return {
    userId: b.props.userId,
    puntosActuales: b.props.puntosActuales,
    puntosTotalesGanados: b.props.puntosTotalesGanados,
    puntosTotalesCanjeados: b.props.puntosTotalesCanjeados,
    updatedAt: b.props.updatedAt ? b.props.updatedAt.toISOString() : null,
  };
}

export function toTransaccionDto(t: Transaccion): TransaccionDto {
  return {
    id: t.props.id ?? 0,
    userId: t.props.userId,
    tipo: t.props.tipo,
    cantidad: t.props.cantidad,
    concepto: t.props.concepto,
    referenciaId: t.props.referenciaId,
    createdAt: t.props.createdAt.toISOString(),
  };
}

export function toRecompensaDto(r: Recompensa): RecompensaDto {
  return {
    id: r.props.id ?? 0,
    nombre: r.props.nombre,
    descripcion: r.props.descripcion,
    puntosRequeridos: r.props.puntosRequeridos,
    tipo: r.props.tipo,
    icono: r.props.icono,
    estado: r.props.estado,
  };
}

export function toCanjeDto(d: CanjeConDetalle): CanjeDto {
  const c = d.canje.props;
  return {
    id: c.id ?? 0,
    userId: c.userId,
    colaboradorNombre: d.colaboradorNombre,
    recompensaId: c.recompensaId,
    recompensaNombre: d.recompensaNombre,
    puntosUsados: c.puntosUsados,
    estado: c.estado,
    aprobadoPor: c.aprobadoPor,
    aprobadoPorNombre: d.aprobadoPorNombre,
    fechaUso: c.fechaUso,
    createdAt: c.createdAt.toISOString(),
  };
}
