import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificacionNueva, NotificacionesPort } from '../../domain/notificaciones.port';

/** Inserta notificaciones para todos los colaboradores activos en una sola sentencia. */
@Injectable()
export class TypeOrmNotificacionesAdapter extends NotificacionesPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async notificarUsuariosActivos(n: NotificacionNueva): Promise<number> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `INSERT INTO notificaciones (user_id, titulo, mensaje, tipo, leida, link, created_at)
       SELECT u.id, $1, $2, $3, FALSE, $4, CURRENT_TIMESTAMP
         FROM users u
        WHERE u.estado_colaborador = 'activo'
       RETURNING id`,
      [n.titulo, n.mensaje, n.tipo, n.link],
    );
    return rows.length;
  }
}
