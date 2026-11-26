import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { Area } from '../../domain/area';
import { AreaRepository, SedeRepository } from '../../domain/repositories';
import { AreaDto, SaveAreaInput } from '../dto/organizacion.dto';

export function toAreaDto(a: Area, sedeNombre: string | null = null, padreNombre: string | null = null): AreaDto {
  return {
    id: a.props.id ?? 0,
    nombre: a.props.nombre,
    descripcion: a.props.descripcion,
    sedeId: a.props.sedeId,
    sedeNombre,
    responsableId: a.props.responsableId,
    padreId: a.props.padreId,
    padreNombre,
    orden: a.props.orden,
    tipo: a.props.tipo,
    estado: a.props.estado,
  };
}

@Injectable()
export class ListAreasUseCase implements UseCase<{ soloActivas?: boolean }, AreaDto[]> {
  constructor(private readonly areas: AreaRepository) {}
  async execute(input: { soloActivas?: boolean }): Promise<AreaDto[]> {
    const todas = await this.areas.findAll();
    const nombres = new Map(todas.map((r) => [r.area.id, r.area.props.nombre]));
    return todas
      .filter((r) => !input.soloActivas || r.area.props.estado === 'activo')
      .map((r) => toAreaDto(r.area, r.sedeNombre, nombres.get(r.area.props.padreId) ?? null));
  }
}

@Injectable()
export class SaveAreaUseCase implements UseCase<SaveAreaInput, AreaDto> {
  constructor(
    private readonly areas: AreaRepository,
    private readonly sedes: SedeRepository,
  ) {}
  async execute(input: SaveAreaInput): Promise<AreaDto> {
    const actual = input.id ? await this.areas.findById(input.id) : null;
    if (input.id && !actual) throw new NotFoundError('Área', input.id);
    if (input.sedeId && !(await this.sedes.findById(input.sedeId))) throw new NotFoundError('Sede', input.sedeId);
    const padreId = input.padreId === undefined ? (actual?.props.padreId ?? null) : input.padreId;
    const padre = padreId ? await this.validarPadre(padreId, input.id ?? null, input.nombre) : null;
    const area = Area.create({
      id: input.id ?? null,
      nombre: input.nombre,
      descripcion: input.descripcion,
      sedeId: input.sedeId,
      responsableId: input.responsableId,
      padreId: padre?.id ?? null,
      orden: input.orden ?? actual?.props.orden ?? 0,
      tipo: input.tipo ?? actual?.props.tipo,
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    return toAreaDto(await this.areas.save(area), null, padre?.props.nombre ?? null);
  }

  /** El área superior debe existir y no puede ser la misma área ni una que dependa de ella (ciclo). */
  private async validarPadre(padreId: number, id: number | null, nombre: string): Promise<Area> {
    const todas = (await this.areas.findAll()).map((r) => r.area);
    const padre = todas.find((a) => a.id === padreId);
    if (!padre) throw new NotFoundError('Área', padreId);
    if (id === null) return padre;
    if (padreId === id) throw new ValidationError('Un área no puede depender de sí misma.');
    const padres = new Map(todas.map((a) => [a.id, a.props.padreId]));
    const vistos = new Set<number>();
    let cursor: number | null = padreId;
    while (cursor !== null && !vistos.has(cursor)) {
      if (cursor === id) {
        throw new ValidationError(`"${padre.props.nombre}" depende de "${nombre}"; moverla ahí crearía un ciclo.`);
      }
      vistos.add(cursor);
      cursor = padres.get(cursor) ?? null;
    }
    return padre;
  }
}

@Injectable()
export class DeleteAreaUseCase implements UseCase<number, void> {
  constructor(private readonly areas: AreaRepository) {}
  async execute(id: number): Promise<void> {
    if (!(await this.areas.findById(id))) throw new NotFoundError('Área', id);
    await this.areas.delete(id);
  }
}
