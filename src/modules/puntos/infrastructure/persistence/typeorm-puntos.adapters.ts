import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ColaboradorDirectory, ColaboradorResumen, NotificacionPublisher, NuevaNotificacion } from '../../domain/ports';

interface ColaboradorRow {
  id: number;
  nombre: string | null;
  cedula: string | null;
  cargo_nombre: string | null;
}

const toResumen = (r: ColaboradorRow): ColaboradorResumen => ({
  id: Number(r.id),
  nombre: (r.nombre ?? '').trim() || `Usuario #${r.id}`,
  cedula: r.cedula,
  cargoNombre: r.cargo_nombre,
});

/** Consulta directa a `users` (misma regla que `Colaborador_model::get_all`: excluye administradores). */
@Injectable()
export class SqlColaboradorDirectory extends ColaboradorDirectory {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async listActivos(): Promise<ColaboradorResumen[]> {
    const rows: ColaboradorRow[] = await this.dataSource.query(
      `SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS nombre,
              u.cedula, c.nombre AS cargo_nombre
         FROM users u
         LEFT JOIN cargos c ON c.id = u.cargo_id
        WHERE u.role <> 'admin' AND u.estado_colaborador = 'activo'
        ORDER BY u.first_name ASC, u.last_name ASC`,
    );
    return rows.map(toResumen);
  }

  async findById(userId: number): Promise<ColaboradorResumen | null> {
    const rows: ColaboradorRow[] = await this.dataSource.query(
      `SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS nombre,
              u.cedula, c.nombre AS cargo_nombre
         FROM users u
         LEFT JOIN cargos c ON c.id = u.cargo_id
        WHERE u.id = $1
        LIMIT 1`,
      [userId],
    );
    return rows.length ? toResumen(rows[0]) : null;
  }
}

/** Inserta en `notificaciones` (misma forma que `Notificacion_model::create`). */
@Injectable()
export class SqlNotificacionPublisher extends NotificacionPublisher {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async publicar(n: NuevaNotificacion): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notificaciones (user_id, titulo, mensaje, tipo, leida, link)
       VALUES ($1, $2, $3, $4, FALSE, $5)`,
      [n.userId, n.titulo, n.mensaje, n.tipo, n.link],
    );
  }
}
