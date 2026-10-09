import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { ColaboradorDirectory, NotificacionPublisher } from '../../domain/ports';
import { PuntosUnitOfWork } from '../../domain/repositories';
import { Transaccion } from '../../domain/transaccion';
import { AsignarPuntosInput, BalanceDto, ColaboradorResumenDto } from '../dto/puntos.dto';
import { toBalanceDto } from '../mappers';
import { ensureBalance } from './balance.use-cases';
import { LINK_MI_BALANCE } from './canjes.use-cases';

/**
 * Asignar puntos a un colaborador (sólo administradores).
 * Registra el movimiento `ganado`, actualiza el saldo de forma atómica y
 * notifica al colaborador (tipo `puntos`).
 */
@Injectable()
export class AsignarPuntosUseCase implements UseCase<AsignarPuntosInput, BalanceDto> {
  constructor(
    private readonly uow: PuntosUnitOfWork,
    private readonly colaboradores: ColaboradorDirectory,
    private readonly notificaciones: NotificacionPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: AsignarPuntosInput): Promise<BalanceDto> {
    if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
      throw new ValidationError('La cantidad de puntos debe ser un entero mayor que cero.');
    }
    const colaborador = await this.colaboradores.findById(input.userId);
    if (!colaborador) throw new NotFoundError('Colaborador', input.userId);

    const now = this.clock.now();
    const balance = await this.uow.run(async (repos) => {
      await ensureBalance(repos.balances, input.userId);
      await repos.transacciones.save(
        Transaccion.create({
          userId: input.userId,
          tipo: 'ganado',
          cantidad: input.cantidad,
          concepto: input.concepto,
          referenciaId: null,
          createdAt: now,
        }),
      );
      await repos.balances.acreditar(input.userId, input.cantidad);
      return ensureBalance(repos.balances, input.userId);
    });

    await this.notificaciones.publicar({
      userId: input.userId,
      titulo: 'Puntos asignados',
      mensaje: `Recibiste ${input.cantidad} puntos: ${input.concepto.trim()}`,
      tipo: 'puntos',
      link: LINK_MI_BALANCE,
    });
    return toBalanceDto(balance);
  }
}

/** Colaboradores activos para el formulario "Asignar puntos". */
@Injectable()
export class ListColaboradoresUseCase implements UseCase<void, ColaboradorResumenDto[]> {
  constructor(private readonly colaboradores: ColaboradorDirectory) {}
  execute(): Promise<ColaboradorResumenDto[]> {
    return this.colaboradores.listActivos();
  }
}
