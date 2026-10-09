import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Incapacidad } from '../../domain/incapacidad';
import { EstadoPermiso, Permiso, TipoPermiso } from '../../domain/permiso';
import {
  FiltroPermisos,
  IncapacidadConNombre,
  IncapacidadRepository,
  PermisoConNombres,
  PermisoRepository,
  SuspensionConRango,
  VacacionConNombre,
  VacacionesSuspensionRepository,
  VacacionRepository,
} from '../../domain/repositories';
import { Vacacion, VacacionDetalle } from '../../domain/vacacion';
import { VacacionesSuspension } from '../../domain/vacaciones-suspension';
import {
  fechaHoraToString,
  IncapacidadOrmEntity,
  PermisoOrmEntity,
  VacacionDetalleOrmEntity,
  VacacionesSuspensionOrmEntity,
  VacacionOrmEntity,
} from './beneficios.orm-entity';

// ---------- Mappers ORM → dominio ----------

const toPermiso = (r: PermisoOrmEntity): Permiso =>
  Permiso.rehydrate({
    id: r.id,
    userId: r.user_id,
    tipoPermiso: r.tipo_permiso as TipoPermiso,
    fechaSolicitud: r.fecha_solicitud,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    horas: r.horas === null || r.horas === undefined ? null : Number(r.horas),
    justificacion: r.justificacion,
    archivoSoporte: r.archivo_soporte,
    estado: r.estado as EstadoPermiso,
    aprobadoPor: r.aprobado_por,
    observacionRespuesta: r.observacion_respuesta,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

const toIncapacidad = (r: IncapacidadOrmEntity): Incapacidad =>
  Incapacidad.rehydrate({
    id: r.id,
    userId: r.user_id,
    tipo: r.tipo as Incapacidad['props']['tipo'],
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    dias: r.dias,
    entidadEmisora: r.entidad_emisora,
    numeroIncapacidad: r.numero_incapacidad,
    archivoSoporte: r.archivo_soporte,
    estado: r.estado,
    createdAt: r.created_at,
  });

const toVacacion = (r: VacacionOrmEntity): Vacacion => ({
  id: r.id,
  userId: r.user_id,
  periodo: r.periodo,
  diasTotales: r.dias_totales,
  diasTomados: r.dias_tomados,
  diasPendientes: r.dias_pendientes,
  estado: r.estado,
  createdAt: r.created_at,
});

const toDetalle = (r: VacacionDetalleOrmEntity): VacacionDetalle => ({
  id: r.id,
  vacacionId: r.vacacion_id,
  userId: r.user_id,
  fechaInicio: r.fecha_inicio,
  fechaFin: r.fecha_fin,
  dias: r.dias,
  estado: r.estado,
  aprobadoPor: r.aprobado_por,
  observacion: r.observacion,
  createdAt: r.created_at,
});

const toSuspension = (r: VacacionesSuspensionOrmEntity): VacacionesSuspension =>
  VacacionesSuspension.rehydrate({
    id: r.id,
    permisoId: r.permiso_id,
    userId: r.user_id,
    diasTotales: r.dias_totales,
    diasDisfrutados: r.dias_disfrutados,
    diasReintegrados: r.dias_reintegrados,
    motivo: r.motivo,
    suspendidoPor: r.suspendido_por,
    fechaSuspension: r.fecha_suspension,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

const nombreCompleto = (first: string | null | undefined, last: string | null | undefined): string =>
  `${first ?? ''} ${last ?? ''}`.trim();

// ---------- Permisos ----------

@Injectable()
export class TypeOrmPermisoRepository extends PermisoRepository {
  constructor(@InjectRepository(PermisoOrmEntity) private readonly repo: Repository<PermisoOrmEntity>) {
    super();
  }

  async findById(id: number): Promise<Permiso | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toPermiso(row) : null;
  }

  async findByUser(userId: number): Promise<Permiso[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC', id: 'DESC' } });
    return rows.map(toPermiso);
  }

  async findAll(filtro: FiltroPermisos = {}): Promise<PermisoConNombres[]> {
    // Equivale a `Solicitud_model::get_all`: join con el colaborador y (opcional) el aprobador.
    const qb = this.repo
      .createQueryBuilder('p')
      .innerJoin('users', 'u', 'u.id = p.user_id')
      .leftJoin('users', 'a', 'a.id = p.aprobado_por')
      .addSelect('u.first_name', 'u_first_name')
      .addSelect('u.last_name', 'u_last_name')
      .addSelect('a.first_name', 'a_first_name')
      .addSelect('a.last_name', 'a_last_name')
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC');
    if (filtro.estado) qb.where('p.estado = :estado', { estado: filtro.estado });
    const { entities, raw } = await qb.getRawAndEntities<{
      u_first_name: string | null;
      u_last_name: string | null;
      a_first_name: string | null;
      a_last_name: string | null;
    }>();
    return entities.map((e, i) => ({
      permiso: toPermiso(e),
      colaborador: nombreCompleto(raw[i]?.u_first_name, raw[i]?.u_last_name),
      aprobador: e.aprobado_por ? nombreCompleto(raw[i]?.a_first_name, raw[i]?.a_last_name) || null : null,
    }));
  }

  async findVacacionesAprobadas(userId: number, excluirPermisoId: number | null = null): Promise<Permiso[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.user_id = :userId', { userId })
      .andWhere("p.tipo_permiso = 'vacaciones'")
      .andWhere("p.estado = 'aprobado'");
    if (excluirPermisoId) qb.andWhere('p.id <> :excluir', { excluir: excluirPermisoId });
    return (await qb.getMany()).map(toPermiso);
  }

  async findVacacionesByUser(userId: number): Promise<Permiso[]> {
    const rows = await this.repo.find({
      where: { user_id: userId, tipo_permiso: 'vacaciones' },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    return rows.map(toPermiso);
  }

  async save(permiso: Permiso): Promise<Permiso> {
    const p = permiso.props;
    const data: Partial<PermisoOrmEntity> = {
      user_id: p.userId,
      tipo_permiso: p.tipoPermiso,
      fecha_inicio: p.fechaInicio,
      fecha_fin: p.fechaFin,
      horas: p.horas === null ? null : String(p.horas),
      justificacion: p.justificacion,
      archivo_soporte: p.archivoSoporte,
      estado: p.estado,
      aprobado_por: p.aprobadoPor,
      observacion_respuesta: p.observacionRespuesta,
    };
    if (p.fechaSolicitud) data.fecha_solicitud = p.fechaSolicitud;
    if (p.updatedAt) data.updated_at = p.updatedAt;
    if (p.id) {
      await this.repo.update({ id: p.id }, data);
      const row = await this.repo.findOne({ where: { id: p.id } });
      return row ? toPermiso(row) : permiso;
    }
    const saved = await this.repo.save(this.repo.create(data));
    const row = await this.repo.findOne({ where: { id: saved.id } });
    return row ? toPermiso(row) : permiso.withId(saved.id);
  }
}

// ---------- Suspensiones de vacaciones ----------

@Injectable()
export class TypeOrmVacacionesSuspensionRepository extends VacacionesSuspensionRepository {
  constructor(
    @InjectRepository(VacacionesSuspensionOrmEntity) private readonly repo: Repository<VacacionesSuspensionOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super();
  }

  async findByPermiso(permisoId: number): Promise<VacacionesSuspension | null> {
    const row = await this.repo.findOne({ where: { permiso_id: permisoId } });
    return row ? toSuspension(row) : null;
  }

  async findDiasDisfrutados(permisoIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (permisoIds.length === 0) return map;
    const rows = await this.repo.find({ where: { permiso_id: In(permisoIds) } });
    for (const r of rows) map.set(r.permiso_id, r.dias_disfrutados);
    return map;
  }

  async findByUser(userId: number): Promise<SuspensionConRango[]> {
    // Equivale a `MiPuesto_model::get_vacaciones_suspensiones`.
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT vs.*, p.fecha_inicio AS p_fecha_inicio, p.fecha_fin AS p_fecha_fin
         FROM vacaciones_suspensiones vs
         LEFT JOIN permisos p ON p.id = vs.permiso_id
        WHERE vs.user_id = $1
        ORDER BY vs.fecha_suspension DESC, vs.id DESC`,
      [userId],
    );
    return rows.map((r) => ({
      suspension: VacacionesSuspension.rehydrate({
        id: Number(r.id),
        permisoId: Number(r.permiso_id),
        userId: Number(r.user_id),
        diasTotales: Number(r.dias_totales),
        diasDisfrutados: Number(r.dias_disfrutados),
        diasReintegrados: Number(r.dias_reintegrados),
        motivo: (r.motivo as string | null) ?? null,
        suspendidoPor: Number(r.suspendido_por),
        fechaSuspension: fechaHoraToString(r.fecha_suspension) ?? '',
        createdAt: fechaHoraToString(r.created_at),
        updatedAt: fechaHoraToString(r.updated_at),
      }),
      fechaInicio: fechaHoraToString(r.p_fecha_inicio),
      fechaFin: fechaHoraToString(r.p_fecha_fin),
    }));
  }

  async save(suspension: VacacionesSuspension): Promise<VacacionesSuspension> {
    const s = suspension.props;
    const data: Partial<VacacionesSuspensionOrmEntity> = {
      permiso_id: s.permisoId,
      user_id: s.userId,
      dias_totales: s.diasTotales,
      dias_disfrutados: s.diasDisfrutados,
      dias_reintegrados: s.diasReintegrados,
      motivo: s.motivo,
      suspendido_por: s.suspendidoPor,
      fecha_suspension: s.fechaSuspension,
      updated_at: s.updatedAt ?? s.fechaSuspension,
    };
    if (s.id) {
      await this.repo.update({ id: s.id }, data);
      return suspension;
    }
    const saved = await this.repo.save(this.repo.create({ ...data, created_at: s.fechaSuspension }));
    return suspension.withId(saved.id);
  }
}

// ---------- Incapacidades ----------

@Injectable()
export class TypeOrmIncapacidadRepository extends IncapacidadRepository {
  constructor(@InjectRepository(IncapacidadOrmEntity) private readonly repo: Repository<IncapacidadOrmEntity>) {
    super();
  }

  async findByUser(userId: number): Promise<Incapacidad[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { fecha_inicio: 'DESC', id: 'DESC' } });
    return rows.map(toIncapacidad);
  }

  async findAll(): Promise<IncapacidadConNombre[]> {
    const qb = this.repo
      .createQueryBuilder('i')
      .innerJoin('users', 'u', 'u.id = i.user_id')
      .addSelect('u.first_name', 'u_first_name')
      .addSelect('u.last_name', 'u_last_name')
      .orderBy('i.fecha_inicio', 'DESC')
      .addOrderBy('i.id', 'DESC');
    const { entities, raw } = await qb.getRawAndEntities<{ u_first_name: string | null; u_last_name: string | null }>();
    return entities.map((e, i) => ({
      incapacidad: toIncapacidad(e),
      colaborador: nombreCompleto(raw[i]?.u_first_name, raw[i]?.u_last_name),
    }));
  }

  async save(incapacidad: Incapacidad): Promise<Incapacidad> {
    const i = incapacidad.props;
    const saved = await this.repo.save(
      this.repo.create({
        user_id: i.userId,
        tipo: i.tipo,
        fecha_inicio: i.fechaInicio,
        fecha_fin: i.fechaFin,
        dias: i.dias,
        entidad_emisora: i.entidadEmisora,
        numero_incapacidad: i.numeroIncapacidad,
        archivo_soporte: i.archivoSoporte,
        estado: i.estado,
      }),
    );
    const row = await this.repo.findOne({ where: { id: saved.id } });
    return row ? toIncapacidad(row) : incapacidad.withId(saved.id);
  }
}

// ---------- Vacaciones (períodos) ----------

@Injectable()
export class TypeOrmVacacionRepository extends VacacionRepository {
  constructor(
    @InjectRepository(VacacionOrmEntity) private readonly repo: Repository<VacacionOrmEntity>,
    @InjectRepository(VacacionDetalleOrmEntity) private readonly detalles: Repository<VacacionDetalleOrmEntity>,
  ) {
    super();
  }

  async findByUser(userId: number): Promise<Vacacion[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { periodo: 'DESC' } });
    return rows.map(toVacacion);
  }

  async findAll(): Promise<VacacionConNombre[]> {
    const qb = this.repo
      .createQueryBuilder('v')
      .innerJoin('users', 'u', 'u.id = v.user_id')
      .addSelect('u.first_name', 'u_first_name')
      .addSelect('u.last_name', 'u_last_name')
      .orderBy('v.periodo', 'DESC');
    const { entities, raw } = await qb.getRawAndEntities<{ u_first_name: string | null; u_last_name: string | null }>();
    return entities.map((e, i) => ({
      vacacion: toVacacion(e),
      colaborador: nombreCompleto(raw[i]?.u_first_name, raw[i]?.u_last_name),
    }));
  }

  async findDetalles(vacacionIds: number[]): Promise<VacacionDetalle[]> {
    if (vacacionIds.length === 0) return [];
    const rows = await this.detalles.find({ where: { vacacion_id: In(vacacionIds) }, order: { fecha_inicio: 'DESC' } });
    return rows.map(toDetalle);
  }
}
