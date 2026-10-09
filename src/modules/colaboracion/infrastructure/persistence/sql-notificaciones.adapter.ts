import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificacionesPort, NuevaNotificacion } from '../../domain/notificaciones.port';

/** Inserta en `notificaciones` (tabla gestionada por el contexto de notificaciones). */
@Injectable()
export class SqlNotificacionesAdapter extends NotificacionesPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async crear(n: NuevaNotificacion, now: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notificaciones (user_id, titulo, mensaje, tipo, leida, link, created_at) VALUES ($1, $2, $3, $4, FALSE, $5, $6)`,
      [n.userId, n.titulo, n.mensaje, n.tipo, n.link, new Date(now)],
    );
  }
}
