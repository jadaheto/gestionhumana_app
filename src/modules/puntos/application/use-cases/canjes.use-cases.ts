import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { InvalidOperationError, NotFoundError } from '../../../../shared/domain/domain-error';
import { Canje, EstadoCanje } from '../../domain/canje';
import { NotificacionPublisher } from '../../domain/ports';
import { CanjeRepository, PuntosUnitOfWork } from '../../domain/repositories';
import { Transaccion } from '../../domain/transaccion';
import { CanjeDto } from '../dto/puntos.dto';
import { toCanjeDto } from '../mappers';
import { ensureBalance } from './balance.use-cases';

export const LINK_MI_BALANCE = '/puntos/mi-balance';

/**
 * Canjear una recompensa. Reglas:
 * - La recompensa debe existir y estar activa.
 * - El saldo debe alcanzar (si no → InvalidOperationError 422).
 * - En una misma transacción de BD: se descuentan los puntos, se registra el
 *   movimiento `canjeado` y se crea el canje en estado `pendiente`.
 *   Si un administrador lo rechaza, los puntos se reintegran.
 */
@Injectable()
export class CanjearRecompensaUseCase implements UseCase<{ actor: Actor; recompensaId: number }, CanjeDto> {
  constructor(
    private readonly uow: PuntosUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: { actor: Actor; recompensaId: number }): Promise<CanjeDto> {
    const userId = input.actor.id;
    const now = this.clock.now();
    return this.uow.run(async (repos) => {
      const recompensa = await repos.recompensas.findById(input.recompensaId);
      if (!recompensa || !recompensa.activa) throw new NotFoundError('Recompensa no encontrada o no disponible.');

      const balance = await ensureBalance(repos.balances, userId);
      if (!balance.alcanzaPara(recompensa.puntosRequeridos)) {
        throw new InvalidOperationError(`No tienes suficientes puntos. Necesitas ${recompensa.puntosRequeridos} pts.`);
      }
      const descontado = await repos.balances.descontar(userId, recompensa.puntosRequeridos);
      if (!descontado) throw new InvalidOperationError('No tienes suficientes puntos para este canje.');

      const canje = await repos.canjes.save(
        Canje.create({
          userId,
          recompensaId: recompensa.id!,
          puntosUsados: recompensa.puntosRequeridos,
          createdAt: now,
        }),
      );
      await repos.transacciones.save(
        Transaccion.create({
          userId,
          tipo: 'canjeado',
          cantidad: recompensa.puntosRequeridos,
          concepto: `Canje: ${recompensa.props.nombre}`,
          referenciaId: canje.id,
          createdAt: now,
        }),
      );
      const detalle = await repos.canjes.findDetalleById(canje.id!);
      return toCanjeDto(
        detalle ?? {
          canje,
          colaboradorNombre: `${input.actor.firstName} ${input.actor.lastName}`.trim(),
          recompensaNombre: recompensa.props.nombre,
          aprobadoPorNombre: null,
        },
      );
    });
  }
}

/** Canjes del propio actor (todos los estados, más recientes primero). */
@Injectable()
export class ListMisCanjesUseCase implements UseCase<Actor, CanjeDto[]> {
  constructor(private readonly canjes: CanjeRepository) {}
  async execute(actor: Actor): Promise<CanjeDto[]> {
    return (await this.canjes.findConDetalle({ userId: actor.id })).map(toCanjeDto);
  }
}

/** Listado de canjes para administración: pendientes o todos. */
@Injectable()
export class ListCanjesUseCase implements UseCase<{ estado?: EstadoCanje | 'todos' }, CanjeDto[]> {
  constructor(private readonly canjes: CanjeRepository) {}
  async execute(input: { estado?: EstadoCanje | 'todos' }): Promise<CanjeDto[]> {
    const estado = !input.estado || input.estado === 'todos' ? null : input.estado;
    return (await this.canjes.findConDetalle({ estado })).map(toCanjeDto);
  }
}

export type AccionCanje = 'aprobado' | 'rechazado';

/**
 * Aprueba o rechaza un canje pendiente (sólo administradores).
 * - Ya procesado → InvalidOperationError 422 (`ya_procesado` del legado).
 * - Rechazo: reintegra los puntos descontados al canjear y registra un movimiento `reintegro`.
 * - En ambos casos notifica al colaborador.
 */
@Injectable()
export class ResolverCanjeUseCase implements UseCase<{ actor: Actor; canjeId: number; accion: AccionCanje }, CanjeDto> {
  constructor(
    private readonly uow: PuntosUnitOfWork,
    private readonly notificaciones: NotificacionPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: { actor: Actor; canjeId: number; accion: AccionCanje }): Promise<CanjeDto> {
    const now = this.clock.now();
    const resultado = await this.uow.run(async (repos) => {
      const canje = await repos.canjes.findById(input.canjeId);
      if (!canje) throw new NotFoundError('Canje', input.canjeId);

      const resuelto = input.accion === 'aprobado' ? canje.aprobar(input.actor.id) : canje.rechazar(input.actor.id);
      await repos.canjes.save(resuelto);

      if (input.accion === 'rechazado') {
        await ensureBalance(repos.balances, canje.userId);
        await repos.balances.reintegrar(canje.userId, canje.puntosUsados);
        await repos.transacciones.save(
          Transaccion.create({
            userId: canje.userId,
            tipo: 'reintegro',
            cantidad: canje.puntosUsados,
            concepto: `Reintegro por canje rechazado #${canje.id}`,
            referenciaId: canje.id,
            createdAt: now,
          }),
        );
      }
      const detalle = await repos.canjes.findDetalleById(canje.id!);
      return toCanjeDto(
        detalle ?? { canje: resuelto, colaboradorNombre: '', recompensaNombre: '', aprobadoPorNombre: null },
      );
    });

    await this.notificaciones.publicar({
      userId: resultado.userId,
      titulo: input.accion === 'aprobado' ? 'Canje aprobado' : 'Canje rechazado',
      mensaje:
        input.accion === 'aprobado'
          ? `Tu canje de "${resultado.recompensaNombre}" fue aprobado.`
          : `Tu canje de "${resultado.recompensaNombre}" fue rechazado y se reintegraron ${resultado.puntosUsados} puntos.`,
      tipo: 'puntos',
      link: LINK_MI_BALANCE,
    });
    return resultado;
  }
}
