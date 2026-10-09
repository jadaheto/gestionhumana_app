import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from '../../domain/notificacion';
import { NotificacionRepository } from '../../domain/notificacion.repository';
import { NotificacionOrmEntity } from './notificacion.orm-entity';

const toDomain = (r: NotificacionOrmEntity): Notificacion =>
  Notificacion.create({
    id: r.id,
    userId: r.user_id,
    titulo: r.titulo,
    mensaje: r.mensaje,
    tipo: r.tipo,
    leida: !!r.leida,
    link: r.link,
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
  });

@Injectable()
export class TypeOrmNotificacionRepository extends NotificacionRepository {
  constructor(@InjectRepository(NotificacionOrmEntity) private readonly repo: Repository<NotificacionOrmEntity>) {
    super();
  }

  async findRecientes(userId: number, limit: number, soloNoLeidas = false): Promise<Notificacion[]> {
    const rows = await this.repo.find({
      where: soloNoLeidas ? { user_id: userId, leida: false } : { user_id: userId },
      order: { created_at: 'DESC', id: 'DESC' },
      take: limit,
    });
    return rows.map(toDomain);
  }

  countNoLeidas(userId: number): Promise<number> {
    return this.repo.count({ where: { user_id: userId, leida: false } });
  }

  async marcarLeida(id: number, userId: number): Promise<boolean> {
    const result = await this.repo.update({ id, user_id: userId }, { leida: true });
    return (result.affected ?? 0) > 0;
  }

  async marcarTodasLeidas(userId: number): Promise<number> {
    const result = await this.repo.update({ user_id: userId, leida: false }, { leida: true });
    return result.affected ?? 0;
  }

  async eliminar(id: number, userId: number): Promise<boolean> {
    const result = await this.repo.delete({ id, user_id: userId });
    return (result.affected ?? 0) > 0;
  }

  async save(n: Notificacion): Promise<Notificacion> {
    const p = n.props;
    const saved = await this.repo.save(
      this.repo.create({
        user_id: p.userId,
        titulo: p.titulo,
        mensaje: p.mensaje,
        tipo: p.tipo,
        leida: p.leida,
        link: p.link,
        created_at: p.createdAt,
      }),
    );
    return n.withId(saved.id);
  }
}
