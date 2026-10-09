import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaPolitica } from '../../domain/asistencia-politica';
import { AsistenciaPoliticaRepository } from '../../domain/ports';
import { PoliticaAsistenciaDto, SavePoliticaInput } from '../dto/asistencia.dto';
import { toPoliticaDto } from './get-resumen-diario.use-case';

@Injectable()
export class GetPoliticaUseCase implements UseCase<{ sedeId: number }, PoliticaAsistenciaDto> {
  constructor(private readonly politicas: AsistenciaPoliticaRepository) {}
  async execute(input: { sedeId: number }): Promise<PoliticaAsistenciaDto> {
    if (!Number.isInteger(input.sedeId) || input.sedeId <= 0) throw new ValidationError('Debes seleccionar una sede.');
    const existente = await this.politicas.findBySede(input.sedeId);
    return toPoliticaDto(existente ?? AsistenciaPolitica.porDefecto(input.sedeId), existente !== null);
  }
}

/** Crea o actualiza la política de la sede (`Asistencia::guardar_politica`). */
@Injectable()
export class SavePoliticaUseCase implements UseCase<SavePoliticaInput, PoliticaAsistenciaDto> {
  constructor(
    private readonly politicas: AsistenciaPoliticaRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: SavePoliticaInput): Promise<PoliticaAsistenciaDto> {
    if (!input.horaEntradaLimite?.trim() || !input.horaSalidaTemprana?.trim()) {
      throw new ValidationError('Datos de política incompletos.');
    }
    const politica = AsistenciaPolitica.create({
      sedeId: input.sedeId,
      horaEntradaLimite: input.horaEntradaLimite,
      horaSalidaTemprana: input.horaSalidaTemprana,
      toleranciaMinutos: Math.max(0, Number(input.toleranciaMinutos ?? 0)),
      enviarMemorandoTardanza: Boolean(input.enviarMemorandoTardanza),
    });
    return toPoliticaDto(await this.politicas.save(politica, this.clock.now()), true);
  }
}
