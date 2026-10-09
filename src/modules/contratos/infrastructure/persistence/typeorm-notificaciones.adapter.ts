import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificacionesPort, NuevaNotificacion } from '../../domain/ports';

/** Inserta en `notificaciones` (equivale a `Notificacion_model::create`). */
@Injectable()
export class TypeOrmNotificacionesAdapter extends NotificacionesPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async crear(n: NuevaNotificacion): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notificaciones (user_id, titulo, mensaje, tipo, leida, link, created_at)
       VALUES ($1, $2, $3, $4, FALSE, $5, CURRENT_TIMESTAMP)`,
      [n.userId, n.titulo, n.mensaje, n.tipo, n.link],
    );
  }
}
