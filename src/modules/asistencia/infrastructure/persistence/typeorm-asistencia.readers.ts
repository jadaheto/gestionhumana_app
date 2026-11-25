import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ColaboradorAsistencia,
  ColaboradoresSedeReader,
  JustificacionReader,
  SedeOption,
  SedesReader,
} from '../../domain/ports';
import { esColaboradorSql } from '../../../../shared/infrastructure/persistence/es-colaborador.sql';

/** Lectura de `users` por sede (misma regla que `Asistencia_model`: activos y no admin). */
@Injectable()
export class TypeOrmColaboradoresSedeReader extends ColaboradoresSedeReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findActivosBySede(sedeId: number): Promise<ColaboradorAsistencia[]> {
    const rows: Array<{ id: number; first_name: string | null; last_name: string | null; email: string | null }> =
      await this.dataSource.query(
        `SELECT id, first_name, last_name, email
           FROM users
          WHERE ${esColaboradorSql()} AND estado_colaborador = 'activo' AND sede_id = $1
          ORDER BY first_name ASC, last_name ASC`,
        [sedeId],
      );
    return rows.map((r) => ({ id: Number(r.id), firstName: r.first_name, lastName: r.last_name, email: r.email }));
  }

  async resolveUserId(identificacion: string, sedeId: number): Promise<number | null> {
    const ident = identificacion.trim();
    if (ident === '') return null;
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT id FROM users
        WHERE ${esColaboradorSql()} AND sede_id = $1
          AND (TRIM(cedula) = $2 OR TRIM(codigo_empresa) = $2)
        LIMIT 1`,
      [sedeId, ident],
    );
    return rows.length > 0 ? Number(rows[0].id) : null;
  }
}

/** Permisos aprobados (incl. vacaciones) e incapacidades activas que cubren el día. */
@Injectable()
export class TypeOrmJustificacionReader extends JustificacionReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async justificacionDia(userId: number, fecha: string): Promise<string> {
    const permisos: Array<{ tipo_permiso: string | null }> = await this.dataSource.query(
      `SELECT tipo_permiso FROM permisos
        WHERE user_id = $1 AND estado = 'aprobado'
          AND fecha_inicio <= ($2::date + TIME '23:59:59')
          AND fecha_fin >= $2::date
        ORDER BY id DESC LIMIT 1`,
      [userId, fecha],
    );
    if (permisos.length > 0) {
      return permisos[0].tipo_permiso === 'vacaciones' ? 'Vacaciones aprobadas' : 'Permiso aprobado';
    }
    const incapacidades: Array<{ id: number }> = await this.dataSource.query(
      `SELECT id FROM incapacidades
        WHERE user_id = $1 AND estado = 'activo' AND fecha_inicio <= $2::date AND fecha_fin >= $2::date
        LIMIT 1`,
      [userId, fecha],
    );
    return incapacidades.length > 0 ? 'Incapacidad vigente' : '';
  }
}

@Injectable()
export class TypeOrmSedesReader extends SedesReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async listActivas(): Promise<SedeOption[]> {
    const rows: Array<{ id: number; nombre: string }> = await this.dataSource.query(
      `SELECT id, nombre FROM sedes WHERE estado = 'activo' ORDER BY nombre ASC`,
    );
    return rows.map((r) => ({ id: Number(r.id), nombre: r.nombre }));
  }
}
