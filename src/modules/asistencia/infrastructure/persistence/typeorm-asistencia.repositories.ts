import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { AsistenciaPolitica } from '../../domain/asistencia-politica';
import { Marcacion } from '../../domain/marcacion';
import {
  AsistenciaMarcacionRepository,
  AsistenciaPoliticaRepository,
  AsistenciaRegistroRepository,
  AsistenciaResumenRepository,
  claveMarcacion,
  NuevaImportacion,
  ResumenDiarioData,
} from '../../domain/ports';
import {
  EstadoAsistencia,
  RegistroAsistencia,
  ResumenConColaborador,
  ResumenDiario,
} from '../../domain/resumen-diario';
import { AsistenciaOrmEntity, AsistenciaPoliticaOrmEntity } from './asistencia.orm-entities';

@Injectable()
export class TypeOrmAsistenciaPoliticaRepository extends AsistenciaPoliticaRepository {
  constructor(
    @InjectRepository(AsistenciaPoliticaOrmEntity) private readonly repo: Repository<AsistenciaPoliticaOrmEntity>,
  ) {
    super();
  }

  async findBySede(sedeId: number): Promise<AsistenciaPolitica | null> {
    const row = await this.repo.findOne({ where: { sede_id: sedeId } });
    if (!row) return null;
    return AsistenciaPolitica.create({
      sedeId: row.sede_id,
      horaEntradaLimite: row.hora_entrada_limite,
      horaSalidaTemprana: row.hora_salida_temprana,
      toleranciaMinutos: row.tolerancia_minutos,
      enviarMemorandoTardanza: row.enviar_memorando_tardanza ?? true,
    });
  }

  async save(politica: AsistenciaPolitica, updatedAt: Date): Promise<AsistenciaPolitica> {
    const data = {
      hora_entrada_limite: politica.horaEntradaLimite,
      hora_salida_temprana: politica.horaSalidaTemprana,
      tolerancia_minutos: politica.toleranciaMinutos,
      enviar_memorando_tardanza: politica.enviarMemorandoTardanza,
      updated_at: updatedAt,
    };
    const existente = await this.repo.findOne({ where: { sede_id: politica.sedeId } });
    if (existente) {
      await this.repo.update({ id: existente.id }, data);
    } else {
      await this.repo.insert({ ...data, sede_id: politica.sedeId });
    }
    return politica;
  }
}

interface MarcacionRow {
  id: number;
  user_id: number;
  fecha_hora: string;
  tipo_registro: string | null;
}

@Injectable()
export class TypeOrmAsistenciaMarcacionRepository extends AsistenciaMarcacionRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async saveImportacion(imp: NuevaImportacion): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      const [{ id }]: Array<{ id: number }> = await em.query(
        `INSERT INTO asistencia_importaciones (sede_id, archivo, total_filas, importado_por, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [imp.sedeId, imp.archivo.slice(0, 255), imp.marcaciones.length, imp.importadoPor, imp.createdAt],
      );
      for (const m of imp.marcaciones) {
        await em.query(
          `INSERT INTO asistencia_marcaciones
             (importacion_id, sede_id, user_id, identificacion, nombre, fecha_hora, tipo_registro, departamento, dispositivo_no, raw_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7, $8, $9, $10, $11)`,
          [
            id,
            imp.sedeId,
            m.userId,
            m.identificacion.slice(0, 40),
            m.nombre.slice(0, 200),
            m.fechaHora,
            m.tipoRegistro.slice(0, 20),
            m.departamento.slice(0, 120),
            m.dispositivoNo.slice(0, 40),
            JSON.stringify(m),
            imp.createdAt,
          ],
        );
      }
      return Number(id);
    });
  }

  async findBySedeYFecha(sedeId: number, fecha: string): Promise<Marcacion[]> {
    const rows: MarcacionRow[] = await this.dataSource.query(
      `SELECT id, user_id, to_char(fecha_hora, 'YYYY-MM-DD HH24:MI:SS') AS fecha_hora, tipo_registro
         FROM asistencia_marcaciones
        WHERE sede_id = $1
          AND fecha_hora >= $2::date
          AND fecha_hora < ($2::date + INTERVAL '1 day')
          AND user_id IS NOT NULL
        ORDER BY fecha_hora ASC`,
      [sedeId, fecha],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.user_id),
      fechaHora: r.fecha_hora,
      tipoRegistro: r.tipo_registro,
    }));
  }

  async findClavesBySedeYFecha(sedeId: number, fecha: string): Promise<Set<string>> {
    const rows: Array<{ identificacion: string | null; fecha_hora: string }> = await this.dataSource.query(
      `SELECT identificacion, to_char(fecha_hora, 'YYYY-MM-DD HH24:MI:SS') AS fecha_hora
         FROM asistencia_marcaciones
        WHERE sede_id = $1
          AND fecha_hora >= $2::date
          AND fecha_hora < ($2::date + INTERVAL '1 day')`,
      [sedeId, fecha],
    );
    return new Set(rows.map((r) => claveMarcacion(r.identificacion ?? '', r.fecha_hora)));
  }
}

interface ResumenRow {
  id: number;
  user_id: number;
  sede_id: number;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_tarde: number;
  minutos_salida_temprana: number;
  estado: string;
  justificacion: string | null;
  detalle: string | null;
  memo_enviado: boolean | null;
  memo_enviado_at: Date | null;
  memo_error: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  cedula?: string | null;
}

const RESUMEN_SELECT = `r.id, r.user_id, r.sede_id, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.hora_entrada, r.hora_salida,
  r.minutos_tarde, r.minutos_salida_temprana, r.estado, r.justificacion, r.detalle, r.memo_enviado, r.memo_enviado_at, r.memo_error`;

function toResumen(r: ResumenRow): ResumenConColaborador {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    sedeId: Number(r.sede_id),
    fecha: r.fecha,
    horaEntrada: r.hora_entrada,
    horaSalida: r.hora_salida,
    minutosTarde: Number(r.minutos_tarde ?? 0),
    minutosSalidaTemprana: Number(r.minutos_salida_temprana ?? 0),
    estado: (r.estado ?? 'normal') as EstadoAsistencia,
    justificacion: r.justificacion,
    detalle: r.detalle,
    memoEnviado: r.memo_enviado === true,
    memoEnviadoAt: r.memo_enviado_at ? new Date(r.memo_enviado_at) : null,
    memoError: r.memo_error,
    firstName: r.first_name ?? null,
    lastName: r.last_name ?? null,
    email: r.email ?? null,
    cedula: r.cedula ?? null,
  };
}

@Injectable()
export class TypeOrmAsistenciaResumenRepository extends AsistenciaResumenRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async upsert(d: ResumenDiarioData): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO asistencia_resumen_diario
         (user_id, sede_id, fecha, hora_entrada, hora_salida, minutos_tarde, minutos_salida_temprana, estado, justificacion, detalle, created_at, updated_at)
       VALUES ($1, $2, $3::date, $4::time, $5::time, $6, $7, $8, $9, $10, $11, $11)
       ON CONFLICT (user_id, sede_id, fecha) DO UPDATE SET
         hora_entrada = EXCLUDED.hora_entrada,
         hora_salida = EXCLUDED.hora_salida,
         minutos_tarde = EXCLUDED.minutos_tarde,
         minutos_salida_temprana = EXCLUDED.minutos_salida_temprana,
         estado = EXCLUDED.estado,
         justificacion = EXCLUDED.justificacion,
         detalle = EXCLUDED.detalle,
         updated_at = EXCLUDED.updated_at`,
      [
        d.userId,
        d.sedeId,
        d.fecha,
        d.horaEntrada,
        d.horaSalida,
        d.minutosTarde,
        d.minutosSalidaTemprana,
        d.estado,
        d.justificacion,
        d.detalle,
        d.updatedAt,
      ],
    );
  }

  async findByFechaYSede(fecha: string, sedeId: number): Promise<ResumenConColaborador[]> {
    const rows: ResumenRow[] = await this.dataSource.query(
      `SELECT ${RESUMEN_SELECT}, u.first_name, u.last_name, u.email, u.cedula
         FROM asistencia_resumen_diario r
         LEFT JOIN users u ON u.id = r.user_id
        WHERE r.fecha = $1::date AND r.sede_id = $2
        ORDER BY u.first_name ASC, u.last_name ASC`,
      [fecha, sedeId],
    );
    return rows.map(toResumen);
  }

  async findTardePendientesMemo(fecha: string, sedeId: number): Promise<ResumenConColaborador[]> {
    const rows: ResumenRow[] = await this.dataSource.query(
      `SELECT ${RESUMEN_SELECT}, u.first_name, u.last_name, u.email, u.cedula
         FROM asistencia_resumen_diario r
         JOIN users u ON u.id = r.user_id
        WHERE r.fecha = $1::date AND r.sede_id = $2
          AND r.minutos_tarde > 0
          AND COALESCE(r.memo_enviado, FALSE) = FALSE
          AND u.email IS NOT NULL AND u.email <> ''`,
      [fecha, sedeId],
    );
    return rows.map(toResumen);
  }

  async markMemo(id: number, ok: boolean, error: string | null, at: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE asistencia_resumen_diario
          SET memo_enviado = $2, memo_enviado_at = $3, memo_error = $4, updated_at = $5
        WHERE id = $1`,
      [id, ok, ok ? at : null, ok ? null : error, at],
    );
  }

  async findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<ResumenDiario[]> {
    const rows: ResumenRow[] = await this.dataSource.query(
      `SELECT ${RESUMEN_SELECT}
         FROM asistencia_resumen_diario r
        WHERE r.user_id = $1 AND r.fecha BETWEEN $2::date AND $3::date
        ORDER BY r.fecha ASC`,
      [userId, desde, hasta],
    );
    return rows.map(toResumen);
  }
}

@Injectable()
export class TypeOrmAsistenciaRegistroRepository extends AsistenciaRegistroRepository {
  constructor(@InjectRepository(AsistenciaOrmEntity) private readonly repo: Repository<AsistenciaOrmEntity>) {
    super();
  }

  async findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<RegistroAsistencia[]> {
    const rows = await this.repo.find({
      where: { user_id: userId, fecha: Between(desde, hasta) },
      order: { fecha: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      fecha: typeof r.fecha === 'string' ? r.fecha : new Date(r.fecha).toISOString().slice(0, 10),
      horaEntrada: r.hora_entrada,
      horaSalida: r.hora_salida,
      tipo: r.tipo,
      observacion: r.observacion,
      fuente: r.fuente,
    }));
  }
}
