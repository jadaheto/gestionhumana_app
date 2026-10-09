import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { SedeRepository } from '../../domain/repositories';
import { Sede } from '../../domain/sede';
import { SaveSedeInput, SedeDto } from '../dto/organizacion.dto';

@Injectable()
export class ListSedesUseCase implements UseCase<{ soloActivas?: boolean }, SedeDto[]> {
  constructor(private readonly sedes: SedeRepository) {}
  async execute(input: { soloActivas?: boolean }): Promise<SedeDto[]> {
    return (await this.sedes.findAll(input.soloActivas)).map(toSedeDto);
  }
}

@Injectable()
export class SaveSedeUseCase implements UseCase<SaveSedeInput, SedeDto> {
  constructor(private readonly sedes: SedeRepository) {}
  async execute(input: SaveSedeInput): Promise<SedeDto> {
    if (input.id) {
      const existing = await this.sedes.findById(input.id);
      if (!existing) throw new NotFoundError('Sede', input.id);
    }
    const sede = Sede.create({
      id: input.id ?? null,
      nombre: input.nombre,
      direccion: input.direccion,
      ciudad: input.ciudad,
      telefono: input.telefono,
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
    return toSedeDto(await this.sedes.save(sede));
  }
}

@Injectable()
export class DeleteSedeUseCase implements UseCase<number, void> {
  constructor(private readonly sedes: SedeRepository) {}
  async execute(id: number): Promise<void> {
    const existing = await this.sedes.findById(id);
    if (!existing) throw new NotFoundError('Sede', id);
    await this.sedes.delete(id);
  }
}

export function toSedeDto(s: Sede): SedeDto {
  return {
    id: s.props.id ?? 0,
    nombre: s.props.nombre,
    direccion: s.props.direccion,
    ciudad: s.props.ciudad,
    telefono: s.props.telefono,
    estado: s.props.estado,
  };
}
