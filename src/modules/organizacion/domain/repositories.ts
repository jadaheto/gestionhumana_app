import { Area } from './area';
import { Cargo } from './cargo';
import { Sede } from './sede';

export interface AreaConSede extends Area {
  sedeNombre?: string | null;
}

export interface CargoConArea extends Cargo {
  areaNombre?: string | null;
}

export abstract class SedeRepository {
  abstract findAll(soloActivas?: boolean): Promise<Sede[]>;
  abstract findById(id: number): Promise<Sede | null>;
  abstract save(sede: Sede): Promise<Sede>;
  abstract delete(id: number): Promise<void>;
}

export abstract class AreaRepository {
  abstract findAll(soloActivas?: boolean): Promise<Array<{ area: Area; sedeNombre: string | null }>>;
  abstract findById(id: number): Promise<Area | null>;
  abstract save(area: Area): Promise<Area>;
  abstract delete(id: number): Promise<void>;
}

export abstract class CargoRepository {
  abstract findAll(soloActivos?: boolean): Promise<Array<{ cargo: Cargo; areaNombre: string | null }>>;
  abstract findById(id: number): Promise<Cargo | null>;
  abstract save(cargo: Cargo): Promise<Cargo>;
  abstract delete(id: number): Promise<void>;
}
