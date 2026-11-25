import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AniversarioRow,
  ContratoPorVencerRow,
  CumpleaneroRow,
  DashboardQueries,
  DistribucionRow,
  PerfilRow,
  VacacionAprobadaRow,
} from '../../domain/dashboard-queries.port';
import { esColaboradorSql } from '../../../../shared/infrastructure/persistence/es-colaborador.sql';

type Row = Record<string, unknown>;
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const nombre = (r: Row): string => `${r['first_name'] ?? ''} ${r['last_name'] ?? ''}`.trim();

/** Subconsulta reutilizada: fecha de ingreso de referencia de un usuario (misma regla que el legado). */
const FECHA_REFERENCIA_SQL = `
  COALESCE(
    (SELECT c1.fecha_inicio::text FROM contratos c1
      WHERE c1.user_id = u.id AND c1.fecha_inicio IS NOT NULL AND c1.estado = 'activo'
      ORDER BY c1.fecha_inicio DESC, c1.id DESC LIMIT 1),
    (SELECT c2.fecha_inicio::text FROM contratos c2
      WHERE c2.user_id = u.id AND c2.fecha_inicio IS NOT NULL
      ORDER BY c2.fecha_inicio DESC, c2.id DESC LIMIT 1),
    u.fecha_ingreso::text
  )`;

/**
 * Adaptador SQL del puerto `DashboardQueries`. Las consultas son las de
 * `Rrhh_model` y `Vacaciones_model`, parametrizadas con la fecha del reloj
 * de la aplicación en lugar de `CURRENT_DATE` para que sean deterministas.
 */
@Injectable()
export class SqlDashboardQueries extends DashboardQueries {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async countColaboradores(estado?: 'activo' | 'inactivo'): Promise<number> {
    const rows: Row[] = estado
      ? await this.dataSource.query(
          `SELECT COUNT(*) AS total FROM users WHERE ${esColaboradorSql()} AND estado_colaborador = $1`,
          [estado],
        )
      : await this.dataSource.query(`SELECT COUNT(*) AS total FROM users WHERE ${esColaboradorSql()}`);
    return num(rows[0]?.['total']);
  }

  async countPermisosPendientes(): Promise<number> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM permisos WHERE estado = 'pendiente'`,
    );
    return num(rows[0]?.['total']);
  }

  async contratosPorVencer(hoy: string, dias: number, limite: number): Promise<ContratoPorVencerRow[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT c.id, c.user_id, c.tipo_contrato, c.numero_contrato, c.fecha_fin::text AS fecha_fin,
              u.first_name, u.last_name, u.profile_image
         FROM contratos c
         JOIN users u ON u.id = c.user_id
        WHERE c.fecha_fin IS NOT NULL
          AND c.estado = 'activo'
          AND c.fecha_fin BETWEEN $1::date AND ($1::date + ($2::int * INTERVAL '1 day'))
        ORDER BY c.fecha_fin ASC
        LIMIT $3`,
      [hoy, Math.max(1, dias), limite],
    );
    return rows.map((r) => ({
      id: num(r['id']),
      userId: num(r['user_id']),
      nombre: nombre(r),
      profileImage: str(r['profile_image']),
      tipoContrato: String(r['tipo_contrato'] ?? ''),
      numeroContrato: String(r['numero_contrato'] ?? ''),
      fechaFin: String(r['fecha_fin']),
    }));
  }

  colaboradoresPorArea(): Promise<DistribucionRow[]> {
    return this.distribucion(
      `SELECT a.nombre, COUNT(u.id) AS total
         FROM areas a
         LEFT JOIN users u ON u.area_id = a.id AND u.estado_colaborador = 'activo'
        WHERE a.estado = 'activo'
        GROUP BY a.id, a.nombre
        ORDER BY total DESC, a.nombre ASC`,
    );
  }

  colaboradoresPorSede(): Promise<DistribucionRow[]> {
    return this.distribucion(
      `SELECT s.nombre, COUNT(u.id) AS total
         FROM sedes s
         LEFT JOIN users u ON u.sede_id = s.id AND u.estado_colaborador = 'activo'
        WHERE s.estado = 'activo'
        GROUP BY s.id, s.nombre
        ORDER BY total DESC, s.nombre ASC`,
    );
  }

  async cumpleanerosHoy(hoy: string): Promise<CumpleaneroRow[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image, u.fecha_nacimiento::text AS fecha_nacimiento,
              c.nombre AS cargo_nombre, a.nombre AS area_nombre
         FROM users u
         LEFT JOIN cargos c ON c.id = u.cargo_id
         LEFT JOIN areas a ON a.id = u.area_id
        WHERE EXTRACT(MONTH FROM u.fecha_nacimiento) = EXTRACT(MONTH FROM $1::date)
          AND EXTRACT(DAY FROM u.fecha_nacimiento) = EXTRACT(DAY FROM $1::date)
          AND u.estado_colaborador = 'activo'
        ORDER BY u.first_name`,
      [hoy],
    );
    return rows.map((r) => ({ ...this.persona(r), fechaNacimiento: String(r['fecha_nacimiento']) }));
  }

  async aniversariosHoy(hoy: string): Promise<AniversarioRow[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image,
              COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)::text AS fecha_referencia,
              EXTRACT(YEAR FROM AGE($1::date, COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)))::int AS anios,
              c.nombre AS cargo_nombre, a.nombre AS area_nombre
         FROM users u
         LEFT JOIN (SELECT user_id, MIN(fecha_inicio) AS fecha_inicio_min FROM contratos WHERE fecha_inicio IS NOT NULL GROUP BY user_id) mc
                ON mc.user_id = u.id
         LEFT JOIN cargos c ON c.id = u.cargo_id
         LEFT JOIN areas a ON a.id = u.area_id
        WHERE COALESCE(mc.fecha_inicio_min, u.fecha_ingreso) IS NOT NULL
          AND EXTRACT(MONTH FROM COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)) = EXTRACT(MONTH FROM $1::date)
          AND EXTRACT(DAY FROM COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)) = EXTRACT(DAY FROM $1::date)
          AND EXTRACT(YEAR FROM AGE($1::date, COALESCE(mc.fecha_inicio_min, u.fecha_ingreso))) >= 1
          AND u.estado_colaborador = 'activo'
          AND ${esColaboradorSql('u')}
        ORDER BY anios DESC, u.first_name ASC`,
      [hoy],
    );
    return rows.map((r) => ({
      ...this.persona(r),
      fechaReferencia: String(r['fecha_referencia']),
      anios: num(r['anios']),
    }));
  }

  async perfilUsuario(userId: number): Promise<PerfilRow | null> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image,
              ${FECHA_REFERENCIA_SQL} AS fecha_ingreso,
              c.nombre AS cargo_nombre, a.nombre AS area_nombre
         FROM users u
         LEFT JOIN cargos c ON c.id = u.cargo_id
         LEFT JOIN areas a ON a.id = u.area_id
        WHERE u.id = $1`,
      [userId],
    );
    const r = rows[0];
    if (!r) return null;
    return { ...this.persona(r), fechaIngreso: str(r['fecha_ingreso']) };
  }

  async countMisPermisos(userId: number, estado?: 'pendiente'): Promise<number> {
    const rows: Row[] = estado
      ? await this.dataSource.query(`SELECT COUNT(*) AS total FROM permisos WHERE user_id = $1 AND estado = $2`, [
          userId,
          estado,
        ])
      : await this.dataSource.query(`SELECT COUNT(*) AS total FROM permisos WHERE user_id = $1`, [userId]);
    return num(rows[0]?.['total']);
  }

  async vacacionesAprobadas(userId: number): Promise<VacacionAprobadaRow[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT p.id, p.fecha_inicio::date::text AS fecha_inicio, p.fecha_fin::date::text AS fecha_fin,
              vs.dias_disfrutados
         FROM permisos p
         LEFT JOIN vacaciones_suspensiones vs ON vs.permiso_id = p.id
        WHERE p.user_id = $1 AND p.tipo_permiso = 'vacaciones' AND p.estado = 'aprobado'
        ORDER BY p.fecha_inicio`,
      [userId],
    );
    return rows.map((r) => ({
      permisoId: num(r['id']),
      fechaInicio: String(r['fecha_inicio']),
      fechaFin: String(r['fecha_fin']),
      diasDisfrutadosSuspension:
        r['dias_disfrutados'] === null || r['dias_disfrutados'] === undefined ? null : num(r['dias_disfrutados']),
    }));
  }

  private async distribucion(sql: string): Promise<DistribucionRow[]> {
    const rows: Row[] = await this.dataSource.query(sql);
    return rows.map((r) => ({ nombre: String(r['nombre'] ?? ''), total: num(r['total']) }));
  }

  private persona(r: Row) {
    return {
      id: num(r['id']),
      nombre: nombre(r),
      profileImage: str(r['profile_image']),
      cargoNombre: str(r['cargo_nombre']),
      areaNombre: str(r['area_nombre']),
    };
  }
}
