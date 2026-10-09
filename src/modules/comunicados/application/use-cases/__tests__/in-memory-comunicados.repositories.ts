import { Page, PageRequest } from '../../../../../shared/domain/pagination';
import { Comunicado } from '../../../domain/comunicado';
import { ComunicadoMedio } from '../../../domain/comunicado-medio';
import { ComunicadoConAutor, ComunicadoRepository } from '../../../domain/comunicado.repository';
import { ComunicadosMailConfig, ConfigCorreoComunicados } from '../../../domain/comunicados-mail-config.port';
import { Aniversario, ConexionesRepository, Cumpleanero } from '../../../domain/conexiones.repository';
import { NotificacionNueva, NotificacionesPort } from '../../../domain/notificaciones.port';

export class InMemoryComunicadoRepository extends ComunicadoRepository {
  items: Comunicado[] = [];
  private seq = 1;
  private medioSeq = 1;

  findAll(): Promise<ComunicadoConAutor[]> {
    return Promise.resolve(
      [...this.items]
        .sort((a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime() || (b.id ?? 0) - (a.id ?? 0))
        .map((comunicado) => ({ comunicado, creadoPor: 'Administrador Sistema' })),
    );
  }
  findById(id: number): Promise<Comunicado | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
  findPublicados(page: PageRequest): Promise<Page<Comunicado>> {
    const publicados = this.items
      .filter((c) => c.estaPublicado)
      .sort(
        (a, b) =>
          (b.props.publicadoAt?.getTime() ?? 0) - (a.props.publicadoAt?.getTime() ?? 0) || (b.id ?? 0) - (a.id ?? 0),
      );
    const start = (page.page - 1) * page.size;
    return Promise.resolve({
      items: publicados.slice(start, start + page.size),
      total: publicados.length,
      page: page.page,
      size: page.size,
    });
  }
  save(comunicado: Comunicado): Promise<Comunicado> {
    const id = comunicado.id ?? this.seq++;
    const medios = comunicado.medios.map((m: ComunicadoMedio) => (m.id ? m : m.withIds(this.medioSeq++, id)));
    const saved = Comunicado.create({ ...comunicado.props, id, medios });
    this.items = comunicado.id ? this.items.map((c) => (c.id === id ? saved : c)) : [...this.items, saved];
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
    return Promise.resolve();
  }
}

export class InMemoryNotificaciones extends NotificacionesPort {
  readonly creadas: NotificacionNueva[] = [];
  constructor(public usuariosActivos = 3) {
    super();
  }
  notificarUsuariosActivos(n: NotificacionNueva): Promise<number> {
    this.creadas.push(n);
    return Promise.resolve(this.usuariosActivos);
  }
}

export class FakeMailConfig extends ComunicadosMailConfig {
  constructor(
    public cfg: ConfigCorreoComunicados = {
      modo: 'test',
      testTo: 'pruebas@comfasucre.com.co',
      prodTo: 'funcionarios@comfasucre.com.co',
    },
  ) {
    super();
  }
  get(): Promise<ConfigCorreoComunicados> {
    return Promise.resolve(this.cfg);
  }
}

export class InMemoryConexionesRepository extends ConexionesRepository {
  cumpleaneros: Cumpleanero[] = [];
  aniversarios: Aniversario[] = [];
  cumpleanerosHoy(): Promise<Cumpleanero[]> {
    return Promise.resolve(this.cumpleaneros);
  }
  aniversariosHoy(): Promise<Aniversario[]> {
    return Promise.resolve(this.aniversarios);
  }
}
