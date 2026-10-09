import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { SedesReader } from '../../domain/ports';
import { SedeAsistenciaDto } from '../dto/asistencia.dto';

/** Sedes activas para el filtro de la pantalla de asistencia. */
@Injectable()
export class ListSedesAsistenciaUseCase implements UseCase<void, SedeAsistenciaDto[]> {
  constructor(private readonly sedes: SedesReader) {}
  execute(): Promise<SedeAsistenciaDto[]> {
    return this.sedes.listActivas();
  }
}
