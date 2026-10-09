import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { Balance } from '../../domain/balance';
import { BalanceRepository, RecompensaRepository, TransaccionRepository } from '../../domain/repositories';
import { BalanceDto, RecompensaDto, TransaccionDto } from '../dto/puntos.dto';
import { toBalanceDto, toRecompensaDto, toTransaccionDto } from '../mappers';

/** Obtiene el saldo del usuario; si no existe la fila la crea en cero (igual que `Punto_model::get_balance`). */
export async function ensureBalance(balances: BalanceRepository, userId: number): Promise<Balance> {
  return (await balances.findByUserId(userId)) ?? (await balances.create(userId));
}

/** Balance propio del actor autenticado. */
@Injectable()
export class GetMiBalanceUseCase implements UseCase<Actor, BalanceDto> {
  constructor(private readonly balances: BalanceRepository) {}
  async execute(actor: Actor): Promise<BalanceDto> {
    return toBalanceDto(await ensureBalance(this.balances, actor.id));
  }
}

/** Historial de movimientos propios (más recientes primero). */
@Injectable()
export class ListMisTransaccionesUseCase implements UseCase<{ actor: Actor; limit?: number }, TransaccionDto[]> {
  constructor(private readonly transacciones: TransaccionRepository) {}
  async execute(input: { actor: Actor; limit?: number }): Promise<TransaccionDto[]> {
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 500) : undefined;
    return (await this.transacciones.findByUserId(input.actor.id, limit)).map(toTransaccionDto);
  }
}

/** Catálogo de recompensas activas, de menor a mayor costo. */
@Injectable()
export class ListRecompensasUseCase implements UseCase<void, RecompensaDto[]> {
  constructor(private readonly recompensas: RecompensaRepository) {}
  async execute(): Promise<RecompensaDto[]> {
    return (await this.recompensas.findActivas()).map(toRecompensaDto);
  }
}
