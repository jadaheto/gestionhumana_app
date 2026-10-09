import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaMarcacionRepository, ColaboradoresSedeReader } from '../../domain/ports';
import { ImportacionResultadoDto } from '../dto/asistencia.dto';
import { ArchivoMarcaciones, AsistenciaFileParser } from '../ports/asistencia-file-parser.port';

export interface ImportarMarcacionesInput {
  sedeId: number;
  archivo: ArchivoMarcaciones | null;
  actor: Actor;
}

export const EXTENSIONES_PERMITIDAS = ['xlsx', 'csv', 'txt'];
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20 MB, igual que el legado (max_size 20480 KB)

/** Importa el archivo del reloj biométrico de una sede (`Asistencia::importar`). */
@Injectable()
export class ImportarMarcacionesUseCase implements UseCase<ImportarMarcacionesInput, ImportacionResultadoDto> {
  constructor(
    private readonly parser: AsistenciaFileParser,
    private readonly marcaciones: AsistenciaMarcacionRepository,
    private readonly colaboradores: ColaboradoresSedeReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: ImportarMarcacionesInput): Promise<ImportacionResultadoDto> {
    if (!Number.isInteger(input.sedeId) || input.sedeId <= 0) {
      throw new ValidationError('Debes seleccionar una sede para importar asistencia.');
    }
    const archivo = input.archivo;
    if (!archivo || !archivo.buffer || archivo.buffer.length === 0) {
      throw new ValidationError('Debes adjuntar el archivo de marcaciones.');
    }
    const ext = archivo.originalName.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      throw new ValidationError('Tipo de archivo no permitido. Usa XLSX, CSV o TXT.');
    }
    if (archivo.buffer.length > TAMANO_MAXIMO_BYTES) {
      throw new ValidationError('El archivo supera el tamaño máximo permitido (20 MB).');
    }

    const filas = await this.parser.parse(archivo);
    if (filas.length === 0) {
      throw new ValidationError('No se encontraron filas válidas para importar en el archivo.');
    }

    // Resuelve el colaborador una sola vez por identificación.
    const cache = new Map<string, number | null>();
    const marcaciones = [];
    let sinColaborador = 0;
    for (const fila of filas) {
      let userId = cache.get(fila.identificacion);
      if (userId === undefined) {
        userId = await this.colaboradores.resolveUserId(fila.identificacion, input.sedeId);
        cache.set(fila.identificacion, userId);
      }
      if (userId === null) sinColaborador++;
      marcaciones.push({ ...fila, userId });
    }

    const importacionId = await this.marcaciones.saveImportacion({
      sedeId: input.sedeId,
      archivo: archivo.originalName,
      importadoPor: input.actor.id,
      createdAt: this.clock.now(),
      marcaciones,
    });

    return {
      importacionId,
      totalFilas: filas.length,
      sinColaborador,
      mensaje: `Importación completada: ${filas.length} marcación(es) cargadas.`,
    };
  }
}
