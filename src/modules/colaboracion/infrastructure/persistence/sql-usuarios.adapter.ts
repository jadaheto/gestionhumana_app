import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventoSistema, EventosSistemaPort, UsuarioResumen, UsuariosPort } from '../../domain/usuarios.port';
import { esColaboradorSql } from '../../../../shared/infrastructure/persistence/es-colaborador.sql';

type Row = Record<string, unknown>;
const toUsuario = (r: Row): UsuarioResumen => ({
  id: Number(r['id']),
  nombre: `${r['first_name'] ?? ''} ${r['last_name'] ?? ''}`.trim() || String(r['username'] ?? ''),
  email: String(r['email'] ?? ''),
  profileImage: (r['profile_image'] as string | null) ?? null,
});

/** Directorio de usuarios mediante SQL directo sobre `users` (sin depender de otro módulo). */
@Injectable()
export class SqlUsuariosAdapter extends UsuariosPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async listar(): Promise<UsuarioResumen[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT id, username, first_name, last_name, email, profile_image FROM users ORDER BY first_name ASC, last_name ASC`,
    );
    return rows.map(toUsuario);
  }

  async existe(id: number): Promise<boolean> {
    const rows: Row[] = await this.dataSource.query(`SELECT 1 FROM users WHERE id = $1 LIMIT 1`, [id]);
    return rows.length > 0;
  }

  async buscarPorEmail(email: string): Promise<UsuarioResumen | null> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT id, username, first_name, last_name, email, profile_image FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    return rows[0] ? toUsuario(rows[0]) : null;
  }

  async nombresPorIds(ids: number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const rows: Row[] = await this.dataSource.query(
      `SELECT id, username, first_name, last_name, email, profile_image FROM users WHERE id = ANY($1::int[])`,
      [ids],
    );
    return new Map(rows.map((r) => [Number(r['id']), toUsuario(r).nombre]));
  }
}

/** Cumpleaños y fechas de ingreso de colaboradores activos (`Calendar_model::get_special_events`). */
@Injectable()
export class SqlEventosSistemaAdapter extends EventosSistemaPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async listar(): Promise<EventoSistema[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.fecha_nacimiento::text AS fecha_nacimiento,
              COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)::text AS fecha_referencia,
              a.nombre AS area_nombre
         FROM users u
         LEFT JOIN areas a ON a.id = u.area_id
         LEFT JOIN (SELECT user_id, MIN(fecha_inicio) AS fecha_inicio_min FROM contratos WHERE fecha_inicio IS NOT NULL GROUP BY user_id) mc
                ON mc.user_id = u.id
        WHERE ${esColaboradorSql('u')} AND u.estado_colaborador = 'activo'`,
    );
    const eventos: EventoSistema[] = [];
    for (const r of rows) {
      const nombre = `${r['first_name'] ?? ''} ${r['last_name'] ?? ''}`.trim();
      if (!nombre) continue;
      const base = { userId: Number(r['id']), nombre, areaNombre: (r['area_nombre'] as string | null) ?? null };
      if (r['fecha_nacimiento'])
        eventos.push({ ...base, tipo: 'cumpleanos', fechaOrigen: String(r['fecha_nacimiento']) });
      if (r['fecha_referencia'])
        eventos.push({ ...base, tipo: 'aniversario', fechaOrigen: String(r['fecha_referencia']) });
    }
    return eventos;
  }
}
