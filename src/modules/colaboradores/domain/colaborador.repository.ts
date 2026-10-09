import { Colaborador } from './colaborador';

export interface ColaboradorFilters {
  estado?: string;
  areaId?: number;
  sedeId?: number;
}

/** Colaborador acompañado de los nombres de sede, área y cargo (joins del legado). */
export interface ColaboradorConNombres {
  colaborador: Colaborador;
  sedeNombre: string | null;
  areaNombre: string | null;
  cargoNombre: string | null;
  cargoFunciones: string | null;
}

export abstract class ColaboradorRepository {
  /** Listado de administración: excluye a los administradores, ordenado por nombre. */
  abstract findAll(filters: ColaboradorFilters): Promise<ColaboradorConNombres[]>;
  abstract findById(id: number): Promise<Colaborador | null>;
  abstract findDetalle(id: number): Promise<ColaboradorConNombres | null>;
  abstract existsUsername(username: string): Promise<boolean>;
  abstract existsEmail(email: string, excludeId?: number): Promise<boolean>;
  abstract existsCedula(cedula: string, excludeId?: number): Promise<boolean>;
  abstract existsCodigoEmpresa(codigo: string, excludeId?: number): Promise<boolean>;
  abstract create(colaborador: Colaborador, passwordHash: string): Promise<Colaborador>;
  abstract update(colaborador: Colaborador): Promise<void>;
  abstract updateProfileImage(id: number, relativePath: string): Promise<void>;
  abstract delete(id: number): Promise<void>;
}
