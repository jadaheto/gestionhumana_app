import { Area } from '../../../domain/area';
import { Cargo } from '../../../domain/cargo';
import { AreaRepository, CargoRepository, SedeRepository } from '../../../domain/repositories';
import { Sede } from '../../../domain/sede';

export class InMemorySedeRepository extends SedeRepository {
  items: Sede[] = [];
  private seq = 1;
  findAll(soloActivas = false): Promise<Sede[]> {
    return Promise.resolve(this.items.filter((s) => !soloActivas || s.props.estado === 'activo'));
  }
  findById(id: number): Promise<Sede | null> {
    return Promise.resolve(this.items.find((s) => s.id === id) ?? null);
  }
  save(sede: Sede): Promise<Sede> {
    if (sede.id) {
      this.items = this.items.map((s) => (s.id === sede.id ? sede : s));
      return Promise.resolve(sede);
    }
    const saved = sede.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((s) => s.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryAreaRepository extends AreaRepository {
  items: Area[] = [];
  private seq = 1;
  findAll(soloActivas = false): Promise<Array<{ area: Area; sedeNombre: string | null }>> {
    return Promise.resolve(
      this.items.filter((a) => !soloActivas || a.props.estado === 'activo').map((area) => ({ area, sedeNombre: null })),
    );
  }
  findById(id: number): Promise<Area | null> {
    return Promise.resolve(this.items.find((a) => a.id === id) ?? null);
  }
  save(area: Area): Promise<Area> {
    if (area.id) {
      this.items = this.items.map((a) => (a.id === area.id ? area : a));
      return Promise.resolve(area);
    }
    const saved = area.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((a) => a.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryCargoRepository extends CargoRepository {
  items: Cargo[] = [];
  private seq = 1;
  findAll(soloActivos = false): Promise<Array<{ cargo: Cargo; areaNombre: string | null }>> {
    return Promise.resolve(
      this.items
        .filter((c) => !soloActivos || c.props.estado === 'activo')
        .map((cargo) => ({ cargo, areaNombre: null })),
    );
  }
  findById(id: number): Promise<Cargo | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
  save(cargo: Cargo): Promise<Cargo> {
    if (cargo.id) {
      this.items = this.items.map((c) => (c.id === cargo.id ? cargo : c));
      return Promise.resolve(cargo);
    }
    const saved = cargo.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
    return Promise.resolve();
  }
}
