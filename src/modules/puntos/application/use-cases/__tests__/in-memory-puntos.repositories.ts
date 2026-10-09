import { Balance } from '../../../domain/balance';
import { Canje, EstadoCanje } from '../../../domain/canje';
import {
  ColaboradorDirectory,
  ColaboradorResumen,
  NotificacionPublisher,
  NuevaNotificacion,
} from '../../../domain/ports';
import { Recompensa } from '../../../domain/recompensa';
import {
  BalanceRepository,
  CanjeConDetalle,
  CanjeRepository,
  PuntosRepositories,
  PuntosUnitOfWork,
  RecompensaRepository,
  TransaccionRepository,
} from '../../../domain/repositories';
import { Transaccion } from '../../../domain/transaccion';

export class InMemoryBalanceRepository extends BalanceRepository {
  items = new Map<number, Balance>();
  findByUserId(userId: number): Promise<Balance | null> {
    return Promise.resolve(this.items.get(userId) ?? null);
  }
  create(userId: number): Promise<Balance> {
    const b = this.items.get(userId) ?? Balance.vacio(userId);
    this.items.set(userId, b);
    return Promise.resolve(b);
  }
  acreditar(userId: number, cantidad: number): Promise<void> {
    const b = this.items.get(userId)!;
    this.items.set(
      userId,
      Balance.create({
        ...b.props,
        puntosActuales: b.props.puntosActuales + cantidad,
        puntosTotalesGanados: b.props.puntosTotalesGanados + cantidad,
      }),
    );
    return Promise.resolve();
  }
  descontar(userId: number, cantidad: number): Promise<boolean> {
    const b = this.items.get(userId);
    if (!b || b.props.puntosActuales < cantidad) return Promise.resolve(false);
    this.items.set(
      userId,
      Balance.create({
        ...b.props,
        puntosActuales: b.props.puntosActuales - cantidad,
        puntosTotalesCanjeados: b.props.puntosTotalesCanjeados + cantidad,
      }),
    );
    return Promise.resolve(true);
  }
  reintegrar(userId: number, cantidad: number): Promise<void> {
    const b = this.items.get(userId)!;
    this.items.set(
      userId,
      Balance.create({
        ...b.props,
        puntosActuales: b.props.puntosActuales + cantidad,
        puntosTotalesCanjeados: Math.max(b.props.puntosTotalesCanjeados - cantidad, 0),
      }),
    );
    return Promise.resolve();
  }
}

export class InMemoryTransaccionRepository extends TransaccionRepository {
  items: Transaccion[] = [];
  private seq = 1;
  findByUserId(userId: number, limit?: number): Promise<Transaccion[]> {
    const list = this.items
      .filter((t) => t.props.userId === userId)
      .sort((a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime() || (b.id ?? 0) - (a.id ?? 0));
    return Promise.resolve(limit ? list.slice(0, limit) : list);
  }
  save(t: Transaccion): Promise<Transaccion> {
    const saved = t.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}

export class InMemoryRecompensaRepository extends RecompensaRepository {
  items: Recompensa[] = [];
  findActivas(): Promise<Recompensa[]> {
    return Promise.resolve(this.items.filter((r) => r.activa).sort((a, b) => a.puntosRequeridos - b.puntosRequeridos));
  }
  findById(id: number): Promise<Recompensa | null> {
    return Promise.resolve(this.items.find((r) => r.id === id) ?? null);
  }
}

export class InMemoryCanjeRepository extends CanjeRepository {
  items: Canje[] = [];
  private seq = 1;
  nombres: Record<number, string> = {};
  recompensas: Record<number, string> = {};

  findById(id: number): Promise<Canje | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
  findDetalleById(id: number): Promise<CanjeConDetalle | null> {
    const c = this.items.find((x) => x.id === id);
    return Promise.resolve(c ? this.detalle(c) : null);
  }
  findConDetalle(filtro: { estado?: EstadoCanje | null; userId?: number | null }): Promise<CanjeConDetalle[]> {
    return Promise.resolve(
      this.items
        .filter((c) => (!filtro.estado || c.estado === filtro.estado) && (!filtro.userId || c.userId === filtro.userId))
        .map((c) => this.detalle(c)),
    );
  }
  save(canje: Canje): Promise<Canje> {
    if (canje.id) {
      this.items = this.items.map((c) => (c.id === canje.id ? canje : c));
      return Promise.resolve(canje);
    }
    const saved = canje.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  private detalle(c: Canje): CanjeConDetalle {
    return {
      canje: c,
      colaboradorNombre: this.nombres[c.userId] ?? `Usuario #${c.userId}`,
      recompensaNombre: this.recompensas[c.props.recompensaId] ?? `Recompensa #${c.props.recompensaId}`,
      aprobadoPorNombre: c.props.aprobadoPor ? (this.nombres[c.props.aprobadoPor] ?? null) : null,
    };
  }
}

/** Unidad de trabajo en memoria: ejecuta el trabajo sobre los mismos repositorios (sin transacción real). */
export class InMemoryPuntosUnitOfWork extends PuntosUnitOfWork {
  constructor(readonly repos: PuntosRepositories) {
    super();
  }
  run<T>(work: (repos: PuntosRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

export class InMemoryColaboradorDirectory extends ColaboradorDirectory {
  items: ColaboradorResumen[] = [];
  listActivos(): Promise<ColaboradorResumen[]> {
    return Promise.resolve([...this.items]);
  }
  findById(userId: number): Promise<ColaboradorResumen | null> {
    return Promise.resolve(this.items.find((c) => c.id === userId) ?? null);
  }
}

export class InMemoryNotificacionPublisher extends NotificacionPublisher {
  publicadas: NuevaNotificacion[] = [];
  publicar(n: NuevaNotificacion): Promise<void> {
    this.publicadas.push(n);
    return Promise.resolve();
  }
}

export function buildInMemoryPuntos() {
  const balances = new InMemoryBalanceRepository();
  const transacciones = new InMemoryTransaccionRepository();
  const recompensas = new InMemoryRecompensaRepository();
  const canjes = new InMemoryCanjeRepository();
  const uow = new InMemoryPuntosUnitOfWork({ balances, transacciones, recompensas, canjes });
  const colaboradores = new InMemoryColaboradorDirectory();
  const notificaciones = new InMemoryNotificacionPublisher();
  return { balances, transacciones, recompensas, canjes, uow, colaboradores, notificaciones };
}
