import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { Cargo } from '../../domain/cargo';
import { AreaRepository, CargoRepository } from '../../domain/repositories';
import { CargoDto, SaveCargoInput } from '../dto/organizacion.dto';

export function toCargoDto(c: Cargo, areaNombre: string | null = null): CargoDto {
  return {
    id: c.props.id ?? 0,
    nombre: c.props.nombre,
    descripcion: c.props.descripcion,
    areaId: c.props.areaId,
    areaNombre,
    nivelJerarquico: c.props.nivelJerarquico,
    nivelNombre: c.nivelNombre,
    funciones: c.props.funciones,
    estado: c.props.estado,
  };
}

@Injectable()
export class ListCargosUseCase implements UseCase<{ soloActivos?: boolean }, CargoDto[]> {
  constructor(private readonly cargos: CargoRepository) {}
  async execute(input: { soloActivos?: boolean }): Promise<CargoDto[]> {
    return (await this.cargos.findAll(input.soloActivos)).map((r) => toCargoDto(r.cargo, r.areaNombre));
  }
}

@Injectable()
export class SaveCargoUseCase implements UseCase<SaveCargoInput, CargoDto> {
  constructor(
    private readonly cargos: CargoRepository,
    private readonly areas: AreaRepository,
  ) {}
  async execute(input: SaveCargoInput): Promise<CargoDto> {
    if (input.id && !(await this.cargos.findById(input.id))) throw new NotFoundError('Cargo', input.id);
    if (input.areaId && !(await this.areas.findById(input.areaId))) throw new NotFoundError('Área', input.areaId);
    const cargo = Cargo.create({
      id: input.id ?? null,
      nombre: input.nombre,
      descripcion: input.descripcion,
      areaId: input.areaId,
      nivelJerarquico: input.nivelJerarquico,
      funciones: input.funciones,
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    return toCargoDto(await this.cargos.save(cargo));
  }
}

@Injectable()
export class DeleteCargoUseCase implements UseCase<number, void> {
  constructor(private readonly cargos: CargoRepository) {}
  async execute(id: number): Promise<void> {
    if (!(await this.cargos.findById(id))) throw new NotFoundError('Cargo', id);
    await this.cargos.delete(id);
  }
}
