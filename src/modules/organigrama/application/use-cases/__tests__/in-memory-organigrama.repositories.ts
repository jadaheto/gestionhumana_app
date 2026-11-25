import { FilaDependencia } from '../../../domain/dependencias';
import { ColaboradorDirectorio, FiltrosDirectorio } from '../../../domain/directorio';
import { FilaOrganigrama } from '../../../domain/organigrama';
import {
  DependenciasRepository,
  DirectorioRepository,
  ImportacionCargosRepository,
  OrganigramaRepository,
} from '../../../domain/repositories';

export class InMemoryOrganigramaRepository extends OrganigramaRepository {
  filas: FilaOrganigrama[] = [];
  findFilas(): Promise<FilaOrganigrama[]> {
    return Promise.resolve([...this.filas]);
  }
}

export class InMemoryDependenciasRepository extends DependenciasRepository {
  filas: FilaDependencia[] = [];
  findFilas(): Promise<FilaDependencia[]> {
    return Promise.resolve([...this.filas]);
  }
}

export class InMemoryDirectorioRepository extends DirectorioRepository {
  items: ColaboradorDirectorio[] = [];
  ultimosFiltros: FiltrosDirectorio | null = null;
  buscar(filtros: FiltrosDirectorio): Promise<ColaboradorDirectorio[]> {
    this.ultimosFiltros = filtros;
    const q = (filtros.q ?? '').toLowerCase();
    return Promise.resolve(
      this.items.filter(
        (c) =>
          (!q ||
            c.nombreCompleto.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.cargo ?? '').toLowerCase().includes(q)) &&
          (!filtros.areaId || c.areaId === filtros.areaId) &&
          (!filtros.sedeId || c.sedeId === filtros.sedeId),
      ),
    );
  }
}

export interface AreaMem {
  id: number;
  nombre: string;
}
export interface CargoMem {
  id: number;
  nombre: string;
  areaId: number;
  nivel: number;
}
export interface SalarioMem {
  cargoId: number;
  salario2024: number | null;
  aumento2025: number | null;
}

export class InMemoryImportacionCargosRepository extends ImportacionCargosRepository {
  areas: AreaMem[] = [];
  cargos: CargoMem[] = [];
  salarios: SalarioMem[] = [];
  transacciones = 0;
  /** Si se define, la transacción falla tras N escrituras (para probar el rollback). */
  fallarEn: number | null = null;
  private escrituras = 0;
  private seq = 1;

  async enTransaccion<T>(trabajo: (repo: ImportacionCargosRepository) => Promise<T>): Promise<T> {
    this.transacciones++;
    const snapshot = { areas: [...this.areas], cargos: [...this.cargos], salarios: [...this.salarios] };
    try {
      return await trabajo(this);
    } catch (e) {
      Object.assign(this, snapshot);
      throw e;
    }
  }
  private escribir(): void {
    this.escrituras++;
    if (this.fallarEn !== null && this.escrituras >= this.fallarEn) throw new Error('fallo simulado');
  }
  findAreaIdPorNombre(nombre: string): Promise<number | null> {
    return Promise.resolve(
      this.areas.find((a) => a.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.id ?? null,
    );
  }
  crearArea(nombre: string): Promise<number> {
    this.escribir();
    const id = this.seq++;
    this.areas.push({ id, nombre });
    return Promise.resolve(id);
  }
  findCargoIdPorNombre(areaId: number, nombre: string): Promise<number | null> {
    return Promise.resolve(
      this.cargos.find((c) => c.areaId === areaId && c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
        ?.id ?? null,
    );
  }
  crearCargo(areaId: number, nombre: string): Promise<number> {
    this.escribir();
    const id = this.seq++;
    this.cargos.push({ id, nombre, areaId, nivel: 5 });
    return Promise.resolve(id);
  }
  upsertSalario(cargoId: number, salario2024: number | null, aumento2025: number | null): Promise<void> {
    this.escribir();
    const existente = this.salarios.find((s) => s.cargoId === cargoId);
    if (existente) Object.assign(existente, { salario2024, aumento2025 });
    else this.salarios.push({ cargoId, salario2024, aumento2025 });
    return Promise.resolve();
  }
}
