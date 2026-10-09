import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { CargosDatasetParser } from '../../domain/cargos-dataset.parser';
import { FiltrosDirectorio } from '../../domain/directorio';
import { construirArbol } from '../../domain/organigrama';
import { DirectorioRepository, ImportacionCargosRepository, OrganigramaRepository } from '../../domain/repositories';
import {
  ColaboradorDirectorioDto,
  ImportacionCargosResultadoDto,
  ImportarCargosInput,
  JerarquiaDto,
} from '../dto/organigrama.dto';

@Injectable()
export class GetJerarquiaUseCase implements UseCase<void, JerarquiaDto> {
  constructor(private readonly organigrama: OrganigramaRepository) {}
  async execute(): Promise<JerarquiaDto> {
    const filas = await this.organigrama.findFilas();
    const raiz = construirArbol(filas);
    return { configurado: raiz !== null, totalCargos: new Set(filas.map((f) => f.cargoId)).size, raiz };
  }
}

@Injectable()
export class BuscarDirectorioUseCase implements UseCase<FiltrosDirectorio, ColaboradorDirectorioDto[]> {
  constructor(private readonly directorio: DirectorioRepository) {}
  execute(filtros: FiltrosDirectorio): Promise<ColaboradorDirectorioDto[]> {
    return this.directorio.buscar({
      q: filtros.q?.trim() || null,
      areaId: filtros.areaId ?? null,
      sedeId: filtros.sedeId ?? null,
    });
  }
}

/**
 * Importa el dataset pegado (CARGO/AREA y opcionalmente salarios): crea las
 * áreas y cargos que no existan y hace upsert en `cargo_salarios`.
 * Replica `AdminUsuarios::import_cargos_areas_from_text`.
 */
@Injectable()
export class ImportarCargosUseCase implements UseCase<ImportarCargosInput, ImportacionCargosResultadoDto> {
  private readonly parser = new CargosDatasetParser();

  constructor(private readonly importacion: ImportacionCargosRepository) {}

  async execute(input: ImportarCargosInput): Promise<ImportacionCargosResultadoDto> {
    if ((input.dataset ?? '').trim() === '') {
      throw new ValidationError('Debes pegar un dataset con columnas CARGO y AREA (y opcionalmente salarios).');
    }
    const { filas, omitidas } = this.parser.parse(input.dataset);
    if (filas.length === 0) {
      throw new ValidationError('No se encontraron filas válidas con columnas CARGO y AREA en el dataset.');
    }

    const resultado = await this.importacion.enTransaccion(async (repo) => {
      const areasMap = new Map<string, number>();
      const cargosMap = new Map<string, number>();
      let areasCreadas = 0;
      let cargosCreados = 0;
      let salariosGuardados = 0;

      for (const fila of filas) {
        let areaId = areasMap.get(fila.areaKey);
        if (areaId === undefined) {
          const existente = await repo.findAreaIdPorNombre(fila.area);
          if (existente !== null) {
            areaId = existente;
          } else {
            areaId = await repo.crearArea(fila.area);
            areasCreadas++;
          }
          areasMap.set(fila.areaKey, areaId);
        }

        const cargoKey = `${fila.cargoKey}|${areaId}`;
        let cargoId = cargosMap.get(cargoKey);
        if (cargoId === undefined) {
          const existente = await repo.findCargoIdPorNombre(areaId, fila.cargo);
          if (existente !== null) {
            cargoId = existente;
          } else {
            cargoId = await repo.crearCargo(areaId, fila.cargo);
            cargosCreados++;
          }
          cargosMap.set(cargoKey, cargoId);
        }

        if (fila.conSalario && (fila.salario2024 !== null || fila.aumento2025 !== null)) {
          await repo.upsertSalario(cargoId, fila.salario2024, fila.aumento2025);
          salariosGuardados++;
        }
      }
      return { areasCreadas, cargosCreados, salariosGuardados };
    });

    return {
      ...resultado,
      filasOmitidas: omitidas,
      filasProcesadas: filas.length,
      message:
        `Importación completada. Áreas creadas: ${resultado.areasCreadas}, cargos creados: ${resultado.cargosCreados}, ` +
        `salarios guardados: ${resultado.salariosGuardados}, filas omitidas: ${omitidas}.`,
    };
  }
}
