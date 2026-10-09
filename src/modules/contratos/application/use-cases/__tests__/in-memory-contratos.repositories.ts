import { FileStorage, SaveFileOptions, StoredFile } from '../../../../../shared/application/ports/file-storage.port';
import { ContratoDocumentRenderer, DocumentoContrato } from '../../contrato-document-renderer.port';
import { Contrato } from '../../../domain/contrato';
import { ContratoAlerta, ContratoProrroga } from '../../../domain/contrato-prorroga';
import { diferenciaDias } from '../../../domain/fechas';
import {
  BrandingPort,
  ColaboradorResumen,
  NotificacionesPort,
  NuevaNotificacion,
  UsuariosPort,
} from '../../../domain/ports';
import {
  ContratoAlertaRepository,
  ContratoConColaborador,
  ContratoProrrogaRepository,
  ContratoRepository,
  DatosColaborador,
} from '../../../domain/repositories';

export interface UsuarioFake {
  id: number;
  firstName: string;
  lastName: string;
  cedula: string | null;
  role: 'admin' | 'funcionario';
  estadoColaborador: string;
  areaNombre?: string | null;
  cargoNombre?: string | null;
}

/** Usuarios de prueba compartidos por los repos en memoria (simula la tabla `users`). */
export class InMemoryUsuarios extends UsuariosPort {
  items: UsuarioFake[] = [];
  contratos: InMemoryContratoRepository | null = null;

  datos(userId: number): DatosColaborador {
    const u = this.items.find((x) => x.id === userId);
    return {
      firstName: u?.firstName ?? null,
      lastName: u?.lastName ?? null,
      cedula: u?.cedula ?? null,
      codigoEmpresa: null,
      areaNombre: u?.areaNombre ?? null,
      cargoNombre: u?.cargoNombre ?? null,
    };
  }
  listarColaboradores(): Promise<ColaboradorResumen[]> {
    return Promise.resolve(
      this.items
        .filter((u) => u.role !== 'admin')
        .map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          cedula: u.cedula,
          cargoNombre: u.cargoNombre ?? null,
        })),
    );
  }
  existeUsuario(id: number): Promise<boolean> {
    return Promise.resolve(this.items.some((u) => u.id === id));
  }
  listarAdminsActivos(): Promise<number[]> {
    return Promise.resolve(
      this.items.filter((u) => u.role === 'admin' && u.estadoColaborador === 'activo').map((u) => u.id),
    );
  }
  sincronizarEstadoPorContratos(hoy: string): Promise<void> {
    for (const u of this.items) {
      if (u.role === 'admin' || u.estadoColaborador === 'retirado') continue;
      const vigente = (this.contratos?.items ?? []).some((c) => c.props.userId === u.id && c.estaVigente(hoy));
      u.estadoColaborador = vigente ? 'activo' : 'inactivo';
    }
    return Promise.resolve();
  }
}

export class InMemoryContratoRepository extends ContratoRepository {
  items: Contrato[] = [];
  private seq = 1;
  constructor(private readonly usuarios: InMemoryUsuarios) {
    super();
    usuarios.contratos = this;
  }
  private fila(c: Contrato): ContratoConColaborador {
    return { contrato: c, colaborador: this.usuarios.datos(c.props.userId) };
  }
  private ordenados(list: Contrato[]): Contrato[] {
    return [...list].sort(
      (a, b) => b.props.fechaInicio.localeCompare(a.props.fechaInicio) || (b.id ?? 0) - (a.id ?? 0),
    );
  }
  findAll(): Promise<ContratoConColaborador[]> {
    return Promise.resolve(this.ordenados(this.items).map((c) => this.fila(c)));
  }
  findByUser(userId: number): Promise<ContratoConColaborador[]> {
    return Promise.resolve(
      this.ordenados(this.items.filter((c) => c.props.userId === userId)).map((c) => this.fila(c)),
    );
  }
  findById(id: number): Promise<Contrato | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
  findByIdConColaborador(id: number): Promise<ContratoConColaborador | null> {
    const c = this.items.find((x) => x.id === id);
    return Promise.resolve(c ? this.fila(c) : null);
  }
  save(contrato: Contrato): Promise<Contrato> {
    if (contrato.id) {
      this.items = this.items.map((c) => (c.id === contrato.id ? contrato : c));
      return Promise.resolve(contrato);
    }
    const saved = contrato.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
    return Promise.resolve();
  }
  finalizarVencidos(hoy: string): Promise<number> {
    let n = 0;
    this.items = this.items.map((c) => {
      if (!c.estaVencido(hoy)) return c;
      n++;
      return c.finalizar();
    });
    return Promise.resolve(n);
  }
  findPorVencer(hoy: string, dias: number): Promise<ContratoConColaborador[]> {
    return Promise.resolve(
      this.items
        .filter((c) => {
          if (c.props.estado !== 'activo' || !c.props.fechaFin) return false;
          const d = diferenciaDias(hoy, c.props.fechaFin);
          return d >= 0 && d <= dias;
        })
        .sort((a, b) => a.props.fechaFin!.localeCompare(b.props.fechaFin!))
        .map((c) => this.fila(c)),
    );
  }
}

export class InMemoryContratoProrrogaRepository extends ContratoProrrogaRepository {
  items: ContratoProrroga[] = [];
  private seq = 1;
  constructor(private readonly contratos: InMemoryContratoRepository) {
    super();
  }
  async registrar(prorroga: ContratoProrroga, contratoActualizado: Contrato): Promise<ContratoProrroga> {
    const saved = { ...prorroga, id: this.seq++ };
    this.items.push(saved);
    await this.contratos.save(contratoActualizado);
    return saved;
  }
  findByContrato(contratoId: number): Promise<ContratoProrroga[]> {
    return Promise.resolve(this.items.filter((p) => p.contratoId === contratoId).reverse());
  }
}

export class InMemoryContratoAlertaRepository extends ContratoAlertaRepository {
  items: ContratoAlerta[] = [];
  private key(a: ContratoAlerta): string {
    return `${a.contratoId}|${a.destinatarioId}|${a.alertaTipo}|${a.alertaFecha}`;
  }
  exists(a: ContratoAlerta): Promise<boolean> {
    return Promise.resolve(this.items.some((x) => this.key(x) === this.key(a)));
  }
  save(a: ContratoAlerta): Promise<void> {
    if (!this.items.some((x) => this.key(x) === this.key(a))) this.items.push(a);
    return Promise.resolve();
  }
}

export class InMemoryNotificaciones extends NotificacionesPort {
  items: NuevaNotificacion[] = [];
  crear(n: NuevaNotificacion): Promise<void> {
    this.items.push(n);
    return Promise.resolve();
  }
}

export class FakeBranding extends BrandingPort {
  logoOscuro(): Promise<Buffer | null> {
    return Promise.resolve(null);
  }
}

/** Renderizador que devuelve el documento serializado para inspeccionar el contenido en tests. */
export class FakeDocumentRenderer extends ContratoDocumentRenderer {
  ultimo: DocumentoContrato | null = null;
  render(documento: DocumentoContrato): Promise<Buffer> {
    this.ultimo = documento;
    return Promise.resolve(
      Buffer.from(JSON.stringify({ ...documento, logo: null, firma: { ...documento.firma, imagenPng: null } })),
    );
  }
}

export class FakeFileStorage extends FileStorage {
  guardados: Array<{ content: Buffer; options: SaveFileOptions }> = [];
  save(content: Buffer, options: SaveFileOptions): Promise<StoredFile> {
    this.guardados.push({ content, options });
    return Promise.resolve({
      relativePath: `${options.folder}/f.png`,
      filename: 'f.png',
      size: content.length,
      mimeType: options.mimeType,
    });
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  read(): Promise<Buffer> {
    return Promise.resolve(Buffer.alloc(0));
  }
  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }
  absolutePath(p: string): string {
    return p;
  }
}
