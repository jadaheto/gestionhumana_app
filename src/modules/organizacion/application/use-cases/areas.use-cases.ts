import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { Area } from '../../domain/area';
import { AreaRepository, SedeRepository } from '../../domain/repositories';
import { AreaDto, SaveAreaInput } from '../dto/organizacion.dto';

export function toAreaDto(a: Area, sedeNombre: string | null = null): AreaDto {
  return {
    id: a.props.id ?? 0,
    nombre: a.props.nombre,
    descripcion: a.props.descripcion,
    sedeId: a.props.sedeId,
    sedeNombre,
    responsableId: a.props.responsableId,
    estado: a.props.estado,
  };
}

@Injectable()
export class ListAreasUseCase implements UseCase<{ soloActivas?: boolean }, AreaDto[]> {
  constructor(private readonly areas: AreaRepository) {}
  async execute(input: { soloActivas?: boolean }): Promise<AreaDto[]> {
    return (await this.areas.findAll(input.soloActivas)).map((r) => toAreaDto(r.area, r.sedeNombre));
  }
}

@Injectable()
export class SaveAreaUseCase implements UseCase<SaveAreaInput, AreaDto> {
  constructor(
    private readonly areas: AreaRepository,
    private readonly sedes: SedeRepository,
  ) {}
  async execute(input: SaveAreaInput): Promise<AreaDto> {
    if (input.id && !(await this.areas.findById(input.id))) throw new NotFoundError('Área', input.id);
    if (input.sedeId && !(await this.sedes.findById(input.sedeId))) throw new NotFoundError('Sede', input.sedeId);
    const area = Area.create({
      id: input.id ?? null,
      nombre: input.nombre,
      descripcion: input.descripcion,
      sedeId: input.sedeId,
      responsableId: input.responsableId,
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    return toAreaDto(await this.areas.save(area));
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
