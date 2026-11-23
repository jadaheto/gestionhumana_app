import { Usuario } from './usuario';

/** Fila de listado con los nombres de sede/área/cargo resueltos. */
export interface UsuarioConCatalogos {
  usuario: Usuario;
  sedeNombre: string | null;
  areaNombre: string | null;
  cargoNombre: string | null;
}

export abstract class UsuarioRepository {
  abstract findAll(): Promise<UsuarioConCatalogos[]>;
  abstract findById(id: number): Promise<UsuarioConCatalogos | null>;
  abstract existsByUsername(username: string, excludeId?: number): Promise<boolean>;
  abstract existsByEmail(email: string, excludeId?: number): Promise<boolean>;
  /** Inserta el usuario con la contraseña ya cifrada y devuelve la entidad con id. */
  abstract create(usuario: Usuario, passwordHash: string): Promise<Usuario>;
  abstract update(usuario: Usuario): Promise<void>;
  abstract updatePasswordHash(id: number, passwordHash: string): Promise<void>;
  abstract delete(id: number): Promise<void>;
}
