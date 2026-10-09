import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { UsuariosPort } from '../../domain/ports';
import { ContratoRepository } from '../../domain/repositories';

export interface SincronizarInput {
  /** `true` = ejecutar siempre (`sync_expired_contracts`); `false` = como máximo una vez al día (`sync_expired_contracts_daily`). */
  forzar?: boolean;
}

/**
 * Marca como finalizados los contratos activos ya vencidos y sincroniza
 * `users.estado_colaborador`. Replica `sync_expired_contracts[_daily]`: el
 * vencimiento solo cambia al pasar de fecha, así que la variante diaria
 * recuerda la última fecha ejecutada (en memoria, en lugar del marcador en
 * disco del legado).
 */
@Injectable()
export class SincronizarContratosVencidosUseCase implements UseCase<SincronizarInput, number> {
  private ultimaFecha: string | null = null;

  constructor(
    private readonly contratos: ContratoRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: SincronizarInput = {}): Promise<number> {
    const hoy = this.clock.today();
    if (!input.forzar && this.ultimaFecha === hoy) return 0;
    this.ultimaFecha = hoy;
    const finalizados = await this.contratos.finalizarVencidos(hoy);
    await this.usuarios.sincronizarEstadoPorContratos(hoy);
    return finalizados;
  }
}
