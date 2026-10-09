import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { Certificado, NuevoCertificado } from '../../domain/certificado';
import { CuentaBancaria, TipoCuenta } from '../../domain/cuenta-bancaria';
import { Desprendible, toConceptos } from '../../domain/desprendible';
import {
  ContadoresLote,
  LotePrevioResumen,
  NominaImportError,
  NominaImportLote,
  NominaParsePreview,
  NominaPreview,
  NuevoErrorImportacion,
  NuevoLote,
} from '../../domain/nomina-import';
import {
  CertificadoRepository,
  CuentaBancariaRepository,
  DesprendibleRepository,
  FiltroTipoCertificado,
  NominaImportLoteRepository,
  NominaPreviewStore,
} from '../../domain/repositories';
import { CertificadoOrmEntity } from './certificado.orm-entity';
import { CuentaBancariaOrmEntity } from './cuenta-bancaria.orm-entity';
import { DesprendibleNominaOrmEntity } from './desprendible-nomina.orm-entity';
import { NominaImportErrorOrmEntity } from './nomina-import-error.orm-entity';
import { NominaImportLoteOrmEntity } from './nomina-import-lote.orm-entity';
import { NominaImportPreviewOrmEntity } from './nomina-import-preview.orm-entity';

const num = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// ---------- Cuentas bancarias ----------
const toCuenta = (r: CuentaBancariaOrmEntity): CuentaBancaria =>
  CuentaBancaria.create({
    id: r.id,
    userId: r.user_id,
    banco: r.banco,
    tipoCuenta: r.tipo_cuenta as TipoCuenta,
    numeroCuenta: r.numero_cuenta,
    createdAt: r.created_at,
  });

@Injectable()
export class TypeOrmCuentaBancariaRepository extends CuentaBancariaRepository {
  constructor(@InjectRepository(CuentaBancariaOrmEntity) private readonly repo: Repository<CuentaBancariaOrmEntity>) {
    super();
  }
  async findByUser(userId: number): Promise<CuentaBancaria[]> {
    return (await this.repo.find({ where: { user_id: userId }, order: { id: 'ASC' } })).map(toCuenta);
  }
  async findByIdAndUser(id: number, userId: number): Promise<CuentaBancaria | null> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    return row ? toCuenta(row) : null;
  }
  async save(cuenta: CuentaBancaria): Promise<CuentaBancaria> {
    const p = cuenta.props;
    const data = { user_id: p.userId, banco: p.banco, tipo_cuenta: p.tipoCuenta, numero_cuenta: p.numeroCuenta };
    if (p.id) {
      await this.repo.update({ id: p.id, user_id: p.userId }, data);
      return cuenta;
    }
    const saved = await this.repo.save(this.repo.create(data));
    return CuentaBancaria.create({ ...p, id: saved.id, createdAt: saved.created_at });
  }
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}

// ---------- Desprendibles ----------
export const toDesprendible = (r: DesprendibleNominaOrmEntity): Desprendible => ({
  id: r.id,
  userId: r.user_id,
  periodo: r.periodo,
  salarioBasico: num(r.salario_basico),
  devengados: toConceptos(r.devengados),
  deducciones: toConceptos(r.deducciones),
  totalDevengado: num(r.total_devengado),
  totalDeducido: num(r.total_deducido),
  netoPagar: num(r.neto_pagar),
  fechaInicio: r.fecha_inicio,
  fechaFin: r.fecha_fin,
  fechaLiquidacion: r.fecha_liquidacion,
  nroComprobante: r.nro_comprobante,
  banco: r.banco,
  numeroCuenta: r.numero_cuenta,
  archivoPdf: r.archivo_pdf,
  createdAt: r.created_at,
});

@Injectable()
export class TypeOrmDesprendibleRepository extends DesprendibleRepository {
  constructor(
    @InjectRepository(DesprendibleNominaOrmEntity) private readonly repo: Repository<DesprendibleNominaOrmEntity>,
  ) {
    super();
  }
  async findByUser(userId: number): Promise<Desprendible[]> {
    const rows = await this.repo
      .createQueryBuilder('d')
      .where('d.user_id = :userId', { userId })
      .orderBy('d.fecha_fin', 'DESC', 'NULLS LAST')
      .addOrderBy('d.periodo', 'DESC')
      .getMany();
    return rows.map(toDesprendible);
  }
  async findByIdAndUser(id: number, userId: number): Promise<Desprendible | null> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    return row ? toDesprendible(row) : null;
  }
}

// ---------- Certificados ----------
const toCertificado = (r: CertificadoOrmEntity): Certificado => ({
  id: r.id,
  userId: r.user_id,
  tipo: r.tipo,
  fechaGeneracion: r.fecha_generacion,
  archivoPdf: r.archivo_pdf,
  generadoPor: r.generado_por,
  datos: r.datos ?? {},
  createdAt: r.created_at,
});

@Injectable()
export class TypeOrmCertificadoRepository extends CertificadoRepository {
  constructor(@InjectRepository(CertificadoOrmEntity) private readonly repo: Repository<CertificadoOrmEntity>) {
    super();
  }
  async findByUser(userId: number, tipo?: FiltroTipoCertificado): Promise<Certificado[]> {
    const qb = this.repo.createQueryBuilder('c').where('c.user_id = :userId', { userId });
    if (tipo === 'laboral') qb.andWhere('c.tipo LIKE :like', { like: '%laboral%' });
    else if (tipo) qb.andWhere('c.tipo = :tipo', { tipo });
    qb.orderBy('c.fecha_generacion', 'DESC').addOrderBy('c.id', 'DESC');
    return (await qb.getMany()).map(toCertificado);
  }
  async save(c: NuevoCertificado): Promise<Certificado> {
    const saved = await this.repo.save(
      this.repo.create({
        user_id: c.userId,
        tipo: c.tipo,
        fecha_generacion: c.fechaGeneracion,
        archivo_pdf: c.archivoPdf,
        generado_por: c.generadoPor,
        datos: c.datos,
      }),
    );
    return toCertificado(saved);
  }
}

// ---------- Lotes de importación ----------
const toLote = (r: NominaImportLoteOrmEntity, createdByNombre: string | null = null): NominaImportLote => ({
  id: r.id,
  archivo: r.archivo,
  archivoOriginal: r.archivo_original,
  fuente: r.fuente ?? '',
  tipoNomina: r.tipo_nomina ?? '',
  fechaLiquidacion: r.fecha_liquidacion,
  fechaInicio: r.fecha_inicio,
  fechaFin: r.fecha_fin,
  totalEmpleadosPdf: r.total_empleados_pdf,
  empleadosCreados: r.empleados_creados,
  empleadosActualizados: r.empleados_actualizados,
  desprendiblesCreados: r.desprendibles_creados,
  desprendiblesActualizados: r.desprendibles_actualizados,
  contratosActualizados: r.contratos_actualizados,
  errores: r.errores,
  estado: r.estado,
  detalle: r.detalle,
  createdBy: r.created_by,
  createdByNombre,
  createdAt: r.created_at,
});

const CONTADOR_COLUMNAS: Record<keyof ContadoresLote, string> = {
  empleadosCreados: 'empleados_creados',
  empleadosActualizados: 'empleados_actualizados',
  desprendiblesCreados: 'desprendibles_creados',
  desprendiblesActualizados: 'desprendibles_actualizados',
  contratosActualizados: 'contratos_actualizados',
  errores: 'errores',
};

@Injectable()
export class TypeOrmNominaImportLoteRepository extends NominaImportLoteRepository {
  constructor(
    @InjectRepository(NominaImportLoteOrmEntity) private readonly lotes: Repository<NominaImportLoteOrmEntity>,
    @InjectRepository(NominaImportErrorOrmEntity) private readonly errores: Repository<NominaImportErrorOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super();
  }

  async create(l: NuevoLote): Promise<NominaImportLote> {
    const saved = await this.lotes.save(
      this.lotes.create({
        archivo: l.archivo,
        archivo_original: l.archivoOriginal,
        fuente: l.fuente,
        tipo_nomina: l.tipoNomina,
        fecha_liquidacion: l.fechaLiquidacion,
        fecha_inicio: l.fechaInicio,
        fecha_fin: l.fechaFin,
        total_empleados_pdf: l.totalEmpleadosPdf,
        estado: l.estado,
        detalle: l.detalle,
        created_by: l.createdBy,
      }),
    );
    return toLote(saved);
  }

  async findById(id: number): Promise<NominaImportLote | null> {
    const row = await this.lotes.findOne({ where: { id } });
    return row ? toLote(row) : null;
  }

  async findPrevioPorPeriodo(fechaInicio: string, fechaFin: string, fuente: string): Promise<LotePrevioResumen | null> {
    const row = await this.lotes.findOne({
      where: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, fuente, estado: In(['completado', 'parcial']) },
      order: { id: 'DESC' },
    });
    return row ? { id: row.id, estado: row.estado, createdAt: row.created_at } : null;
  }

  async incrementarContadores(id: number, inc: Partial<ContadoresLote>): Promise<ContadoresLote> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [key, col] of Object.entries(CONTADOR_COLUMNAS) as Array<[keyof ContadoresLote, string]>) {
      const n = inc[key] ?? 0;
      if (n > 0) {
        params.push(n);
        sets.push(`${col} = ${col} + $${params.length}`);
      }
    }
    if (sets.length > 0) {
      await this.dataSource.query(`UPDATE nomina_import_lotes SET ${sets.join(', ')} WHERE id = $1`, params);
    }
    const row = await this.lotes.findOneOrFail({ where: { id } });
    return {
      empleadosCreados: row.empleados_creados,
      empleadosActualizados: row.empleados_actualizados,
      desprendiblesCreados: row.desprendibles_creados,
      desprendiblesActualizados: row.desprendibles_actualizados,
      contratosActualizados: row.contratos_actualizados,
      errores: row.errores,
    };
  }

  async actualizarEstado(id: number, estado: string, detalle: string | null): Promise<void> {
    await this.lotes.update({ id }, { estado, detalle });
  }

  async cerrarAtascados(antesDe: Date, detalle: string): Promise<number> {
    const result = await this.lotes
      .createQueryBuilder()
      .update()
      .set({ estado: 'error', detalle })
      .where('estado = :estado AND created_at < :antesDe', { estado: 'procesando', antesDe })
      .execute();
    return result.affected ?? 0;
  }

  async historial(limit: number): Promise<NominaImportLote[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT l.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS created_by_nombre
         FROM nomina_import_lotes l
         LEFT JOIN users u ON u.id = l.created_by
        ORDER BY l.id DESC
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => {
      const nombre = String(r.created_by_nombre ?? '').trim();
      return toLote(r as unknown as NominaImportLoteOrmEntity, nombre === '' ? null : nombre);
    });
  }

  async registrarError(e: NuevoErrorImportacion): Promise<void> {
    await this.errores.save(
      this.errores.create({
        lote_id: e.loteId,
        empleado_ref: e.empleadoRef.slice(0, 120),
        mensaje: e.mensaje,
        raw_block: e.rawBlock,
      }),
    );
  }

  async erroresDeLotes(loteIds: number[]): Promise<NominaImportError[]> {
    if (loteIds.length === 0) return [];
    const rows = await this.errores.find({ where: { lote_id: In(loteIds) }, order: { id: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      loteId: r.lote_id,
      empleadoRef: r.empleado_ref ?? '',
      mensaje: r.mensaje ?? '',
      rawBlock: r.raw_block,
      createdAt: r.created_at,
    }));
  }
}

// ---------- Vistas previas ----------
const TOKEN_RE = /^[a-f0-9]{32}$/;

const toPreview = (r: NominaImportPreviewOrmEntity): NominaPreview => ({
  token: r.token,
  parsed: r.parsed as unknown as NominaParsePreview,
  archivo: r.archivo,
  archivoOriginal: r.archivo_original ?? '',
  nuevos: r.nuevos,
  existentes: r.existentes,
  lotePrevio: r.lote_previo
    ? {
        id: Number((r.lote_previo as { id: number }).id),
        estado: String((r.lote_previo as { estado: string }).estado),
        createdAt: new Date(String((r.lote_previo as { createdAt: string }).createdAt)),
      }
    : null,
  loteId: r.lote_id,
  procesados: r.procesados,
  createdBy: r.created_by ?? 0,
  createdAt: r.created_at,
});

@Injectable()
export class TypeOrmNominaPreviewStore extends NominaPreviewStore {
  constructor(
    @InjectRepository(NominaImportPreviewOrmEntity) private readonly repo: Repository<NominaImportPreviewOrmEntity>,
  ) {
    super();
  }

  async save(p: Omit<NominaPreview, 'token'>): Promise<NominaPreview> {
    const token = randomBytes(16).toString('hex');
    const saved = await this.repo.save(
      this.repo.create({
        token,
        lote_id: p.loteId,
        archivo: p.archivo,
        archivo_original: p.archivoOriginal,
        parsed: p.parsed as unknown as Record<string, unknown>,
        nuevos: p.nuevos,
        existentes: p.existentes,
        lote_previo: p.lotePrevio ? { ...p.lotePrevio, createdAt: p.lotePrevio.createdAt.toISOString() } : null,
        procesados: p.procesados,
        created_by: p.createdBy,
        created_at: p.createdAt,
      }),
    );
    return toPreview(saved);
  }

  async get(token: string): Promise<NominaPreview | null> {
    if (!TOKEN_RE.test(token)) return null;
    const row = await this.repo.findOne({ where: { token } });
    return row ? toPreview(row) : null;
  }

  async findByLoteId(loteId: number): Promise<NominaPreview | null> {
    const row = await this.repo.findOne({ where: { lote_id: loteId } });
    return row ? toPreview(row) : null;
  }

  async update(token: string, cambios: Partial<Pick<NominaPreview, 'loteId' | 'procesados'>>): Promise<void> {
    const data: { lote_id?: number | null; procesados?: number } = {};
    if (cambios.loteId !== undefined) data.lote_id = cambios.loteId;
    if (cambios.procesados !== undefined) data.procesados = cambios.procesados;
    if (Object.keys(data).length > 0) await this.repo.update({ token }, data);
  }

  async delete(token: string): Promise<void> {
    await this.repo.delete({ token });
  }

  async purgar(antesDe: Date): Promise<number> {
    const result = await this.repo.delete({ created_at: LessThan(antesDe) });
    return result.affected ?? 0;
  }
}
