import { ColaboradorDirectorio, FiltrosDirectorio } from './directorio';
import { FilaOrganigrama } from './organigrama';

export abstract class OrganigramaRepository {
  /** Filas del organigrama ordenadas por nivel jerárquico y orden. */
  abstract findFilas(): Promise<FilaOrganigrama[]>;
}

export abstract class DirectorioRepository {
  /** Colaboradores activos (no administradores) ordenados por nombre. */
  abstract buscar(filtros: FiltrosDirectorio): Promise<ColaboradorDirectorio[]>;
}

/**
 * Operaciones de escritura del importador de cargos/áreas. Todas las llamadas
 * dentro de `enTransaccion` se ejecutan de forma atómica (como `trans_begin`
 * / `trans_commit` del legado).
 */
export abstract class ImportacionCargosRepository {
  abstract enTransaccion<T>(trabajo: (repo: ImportacionCargosRepository) => Promise<T>): Promise<T>;
  /** Busca un área por nombre (insensible a mayúsculas/espacios). */
  abstract findAreaIdPorNombre(nombre: string): Promise<number | null>;
  abstract crearArea(nombre: string): Promise<number>;
  abstract findCargoIdPorNombre(areaId: number, nombre: string): Promise<number | null>;
  /** Crea el cargo con nivel jerárquico 5 (Auxiliar) y estado activo. */
  abstract crearCargo(areaId: number, nombre: string): Promise<number>;
  abstract upsertSalario(cargoId: number, salario2024: number | null, aumento2025: number | null): Promise<void>;
}
