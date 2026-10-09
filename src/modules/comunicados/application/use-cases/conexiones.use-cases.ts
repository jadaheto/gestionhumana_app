import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ConexionesRepository } from '../../domain/conexiones.repository';
import { ConexionesFeedDto } from '../dto/comunicados.dto';

/** Feed de Conexiones: cumpleaños y aniversarios laborales del día (`Conexiones::feed`). */
@Injectable()
export class FeedConexionesUseCase implements UseCase<void, ConexionesFeedDto> {
  constructor(
    private readonly conexiones: ConexionesRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ConexionesFeedDto> {
    const [cumpleaneros, aniversarios] = await Promise.all([
      this.conexiones.cumpleanerosHoy(),
      this.conexiones.aniversariosHoy(),
    ]);
    return { fecha: this.clock.today(), cumpleaneros, aniversarios };
  }
}
