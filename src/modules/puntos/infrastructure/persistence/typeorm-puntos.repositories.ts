import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { Balance } from '../../domain/balance';
import { Canje, EstadoCanje } from '../../domain/canje';
import { Recompensa } from '../../domain/recompensa';
import {
  BalanceRepository,
  CanjeConDetalle,
  CanjeRepository,
  PuntosRepositories,
  PuntosUnitOfWork,
  RecompensaRepository,
  TransaccionRepository,
} from '../../domain/repositories';
import { TipoTransaccion, Transaccion } from '../../domain/transaccion';
import { CanjeOrmEntity, PuntoOrmEntity, PuntosTransaccionOrmEntity, RecompensaOrmEntity } from './puntos.orm-entities';

const toDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));

const toBalance = (r: PuntoOrmEntity): Balance =>
  Balance.create({
    userId: r.user_id,
    puntosActuales: r.puntos_actuales,
    puntosTotalesGanados: r.puntos_totales_ganados,
    puntosTotalesCanjeados: r.puntos_totales_canjeados,
    updatedAt: r.updated_at ? toDate(r.updated_at) : null,
  });

const toTransaccion = (r: PuntosTransaccionOrmEntity): Transaccion =>
  Transaccion.create({
    id: r.id,
    userId: r.user_id,
    tipo: r.tipo as TipoTransaccion,
    cantidad: r.cantidad,
    concepto: r.concepto,
    referenciaId: r.referencia_id,
    createdAt: toDate(r.created_at),
  });

const toRecompensa = (r: RecompensaOrmEntity): Recompensa =>
  Recompensa.create({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    puntosRequeridos: r.puntos_requeridos,
    tipo: r.tipo,
    icono: r.icono,
    estado: r.estado,
  });

const toCanje = (r: CanjeOrmEntity): Canje =>
  Canje.create({
    id: r.id,
    userId: r.user_id,
    recompensaId: r.recompensa_id,
    puntosUsados: r.puntos_usados,
    estado: r.estado,
    aprobadoPor: r.aprobado_por,
    fechaUso: r.fecha_uso,
    createdAt: toDate(r.created_at),
  });

@Injectable()
export class TypeOrmBalanceRepository extends BalanceRepository {
  constructor(@InjectRepository(PuntoOrmEntity) private readonly repo: Repository<PuntoOrmEntity>) {
    super();
  }
  async findByUserId(userId: number): Promise<Balance | null> {
    const row = await this.repo.findOne({ where: { user_id: userId } });
    return row ? toBalance(row) : null;
  }
  async create(userId: number): Promise<Balance> {
    // ON CONFLICT: otra petición concurrente pudo crear la fila primero.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(PuntoOrmEntity)
      .values({ user_id: userId, puntos_actuales: 0, puntos_totales_ganados: 0, puntos_totales_canjeados: 0 })
      .orIgnore()
      .execute();
    return (await this.findByUserId(userId)) ?? Balance.vacio(userId);
  }
  async acreditar(userId: number, cantidad: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(PuntoOrmEntity)
      .set({
        puntos_actuales: () => `puntos_actuales + ${Number(cantidad)}`,
        puntos_totales_ganados: () => `puntos_totales_ganados + ${Number(cantidad)}`,
        updated_at: () => 'CURRENT_TIMESTAMP',
      })
      .where('user_id = :userId', { userId })
      .execute();
  }
  async descontar(userId: number, cantidad: number): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(PuntoOrmEntity)
      .set({
        puntos_actuales: () => `puntos_actuales - ${Number(cantidad)}`,
        puntos_totales_canjeados: () => `puntos_totales_canjeados + ${Number(cantidad)}`,
        updated_at: () => 'CURRENT_TIMESTAMP',
      })
      .where('user_id = :userId AND puntos_actuales >= :cantidad', { userId, cantidad })
      .execute();
    return (result.affected ?? 0) > 0;
  }
  async reintegrar(userId: number, cantidad: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(PuntoOrmEntity)
      .set({
        puntos_actuales: () => `puntos_actuales + ${Number(cantidad)}`,
        puntos_totales_canjeados: () => `GREATEST(puntos_totales_canjeados - ${Number(cantidad)}, 0)`,
        updated_at: () => 'CURRENT_TIMESTAMP',
      })
      .where('user_id = :userId', { userId })
      .execute();
  }
}

@Injectable()
export class TypeOrmTransaccionRepository extends TransaccionRepository {
  constructor(
    @InjectRepository(PuntosTransaccionOrmEntity) private readonly repo: Repository<PuntosTransaccionOrmEntity>,
  ) {
    super();
  }
  async findByUserId(userId: number, limit?: number): Promise<Transaccion[]> {
    const rows = await this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC', id: 'DESC' },
      ...(limit ? { take: limit } : {}),
    });
    return rows.map(toTransaccion);
  }
  async save(t: Transaccion): Promise<Transaccion> {
    const p = t.props;
    const saved = await this.repo.save(
      this.repo.create({
        user_id: p.userId,
        tipo: p.tipo,
        cantidad: p.cantidad,
        concepto: p.concepto,
        referencia_id: p.referenciaId,
        created_at: p.createdAt,
      }),
    );
    return t.withId(saved.id);
  }
}

@Injectable()
export class TypeOrmRecompensaRepository extends RecompensaRepository {
  constructor(@InjectRepository(RecompensaOrmEntity) private readonly repo: Repository<RecompensaOrmEntity>) {
    super();
  }
  async findActivas(): Promise<Recompensa[]> {
    const rows = await this.repo.find({
      where: { estado: 'activo' },
      order: { puntos_requeridos: 'ASC', nombre: 'ASC' },
    });
    return rows.map(toRecompensa);
  }
  async findById(id: number): Promise<Recompensa | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toRecompensa(row) : null;
  }
}

interface CanjeRaw {
  colaborador_nombre: string | null;
  recompensa_nombre: string | null;
  aprobado_por_nombre: string | null;
}

@Injectable()
export class TypeOrmCanjeRepository extends CanjeRepository {
  constructor(@InjectRepository(CanjeOrmEntity) private readonly repo: Repository<CanjeOrmEntity>) {
    super();
  }
  async findById(id: number): Promise<Canje | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toCanje(row) : null;
  }
  async findDetalleById(id: number): Promise<CanjeConDetalle | null> {
    const { entities, raw } = await this.detalleQuery().where('c.id = :id', { id }).getRawAndEntities<CanjeRaw>();
    return entities.length ? this.toDetalle(entities[0], raw[0]) : null;
  }
  async findConDetalle(filtro: { estado?: EstadoCanje | null; userId?: number | null }): Promise<CanjeConDetalle[]> {
    const qb = this.detalleQuery();
    if (filtro.estado) qb.andWhere('c.estado = :estado', { estado: filtro.estado });
    if (filtro.userId) qb.andWhere('c.user_id = :userId', { userId: filtro.userId });
    // Pendientes primero (los más antiguos arriba, como el legado); el resto, más recientes primero.
    qb.orderBy(`CASE WHEN c.estado = 'pendiente' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy(`CASE WHEN c.estado = 'pendiente' THEN c.created_at END`, 'ASC')
      .addOrderBy('c.created_at', 'DESC');
    const { entities, raw } = await qb.getRawAndEntities<CanjeRaw>();
    return entities.map((e, i) => this.toDetalle(e, raw[i]));
  }
  async save(canje: Canje): Promise<Canje> {
    const p = canje.props;
    const data = {
      user_id: p.userId,
      recompensa_id: p.recompensaId,
      puntos_usados: p.puntosUsados,
      estado: p.estado,
      aprobado_por: p.aprobadoPor,
      fecha_uso: p.fechaUso,
    };
    if (p.id) {
      await this.repo.update({ id: p.id }, data);
      return canje;
    }
    const saved = await this.repo.save(this.repo.create({ ...data, created_at: p.createdAt }));
    return canje.withId(saved.id);
  }

  private detalleQuery() {
    return this.repo
      .createQueryBuilder('c')
      .leftJoin(RecompensaOrmEntity, 'r', 'r.id = c.recompensa_id')
      .leftJoin(UserOrmEntity, 'u', 'u.id = c.user_id')
      .leftJoin(UserOrmEntity, 'a', 'a.id = c.aprobado_por')
      .addSelect(`TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))`, 'colaborador_nombre')
      .addSelect('r.nombre', 'recompensa_nombre')
      .addSelect(
        `NULLIF(TRIM(CONCAT(COALESCE(a.first_name, ''), ' ', COALESCE(a.last_name, ''))), '')`,
        'aprobado_por_nombre',
      );
  }

  private toDetalle(e: CanjeOrmEntity, raw: CanjeRaw | undefined): CanjeConDetalle {
    return {
      canje: toCanje(e),
      colaboradorNombre: raw?.colaborador_nombre || `Usuario #${e.user_id}`,
      recompensaNombre: raw?.recompensa_nombre ?? `Recompensa #${e.recompensa_id}`,
      aprobadoPorNombre: raw?.aprobado_por_nombre ?? null,
    };
  }
}

/** Construye los repositorios ligados a un `EntityManager` (misma transacción). */
export function buildPuntosRepositories(manager: EntityManager): PuntosRepositories {
  return {
    balances: new TypeOrmBalanceRepository(manager.getRepository(PuntoOrmEntity)),
    transacciones: new TypeOrmTransaccionRepository(manager.getRepository(PuntosTransaccionOrmEntity)),
    recompensas: new TypeOrmRecompensaRepository(manager.getRepository(RecompensaOrmEntity)),
    canjes: new TypeOrmCanjeRepository(manager.getRepository(CanjeOrmEntity)),
  };
}

/** Unidad de trabajo sobre `DataSource.transaction`. */
@Injectable()
export class TypeOrmPuntosUnitOfWork extends PuntosUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  run<T>(work: (repos: PuntosRepositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work(buildPuntosRepositories(manager)));
  }
}
