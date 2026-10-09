import { Usuario } from '../../../domain/usuario';
import { PuntosInicializador, UsuarioConCatalogos, UsuarioRepository } from '../../../domain/usuario.repository';

export class InMemoryUsuarioRepository extends UsuarioRepository {
  items: Usuario[] = [];
  passwords = new Map<number, string>();
  /** Nombres de catálogos simulados por id. */
  sedes = new Map<number, string>();
  areas = new Map<number, string>();
  cargos = new Map<number, string>();
  private seq = 1;

  private withCatalogos(u: Usuario): UsuarioConCatalogos {
    return {
      usuario: u,
      sedeNombre: u.props.sedeId ? (this.sedes.get(u.props.sedeId) ?? null) : null,
      areaNombre: u.props.areaId ? (this.areas.get(u.props.areaId) ?? null) : null,
      cargoNombre: u.props.cargoId ? (this.cargos.get(u.props.cargoId) ?? null) : null,
    };
  }

  findAll(): Promise<UsuarioConCatalogos[]> {
    return Promise.resolve(
      [...this.items]
        .sort((a, b) => a.props.firstName.localeCompare(b.props.firstName))
        .map((u) => this.withCatalogos(u)),
    );
  }
  findById(id: number): Promise<UsuarioConCatalogos | null> {
    const u = this.items.find((x) => x.id === id);
    return Promise.resolve(u ? this.withCatalogos(u) : null);
  }
  existsByUsername(username: string, excludeId?: number): Promise<boolean> {
    return Promise.resolve(
      this.items.some((u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== excludeId),
    );
  }
  existsByEmail(email: string, excludeId?: number): Promise<boolean> {
    return Promise.resolve(this.items.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== excludeId));
  }
  create(usuario: Usuario, passwordHash: string): Promise<Usuario> {
    const saved = usuario.withId(this.seq++);
    this.items.push(saved);
    this.passwords.set(saved.id as number, passwordHash);
    return Promise.resolve(saved);
  }
  update(usuario: Usuario): Promise<void> {
    this.items = this.items.map((u) => (u.id === usuario.id ? usuario : u));
    return Promise.resolve();
  }
  updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    this.passwords.set(id, passwordHash);
    return Promise.resolve();
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((u) => u.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryPuntosInicializador extends PuntosInicializador {
  inicializados: number[] = [];
  inicializar(userId: number): Promise<void> {
    this.inicializados.push(userId);
    return Promise.resolve();
  }
}
