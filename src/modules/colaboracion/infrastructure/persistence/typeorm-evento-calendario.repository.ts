import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoCalendario } from '../../domain/evento-calendario';
import { EventoCalendarioRepository } from '../../domain/repositories';
import { CalendarEventOrmEntity } from './calendar-event.orm-entity';
import { fromLocalDateTime, toLocalDateTime } from './fechas';

const toEvento = (r: CalendarEventOrmEntity): EventoCalendario =>
  EventoCalendario.create({
    id: r.id,
    userId: r.user_id,
    titulo: r.title,
    inicio: toLocalDateTime(r.start_date) ?? '',
    fin: toLocalDateTime(r.end_date),
    todoElDia: r.all_day,
    clase: r.class_name,
    ubicacion: r.location,
    descripcion: r.description,
  });

@Injectable()
export class TypeOrmEventoCalendarioRepository extends EventoCalendarioRepository {
  constructor(@InjectRepository(CalendarEventOrmEntity) private readonly repo: Repository<CalendarEventOrmEntity>) {
    super();
  }

  async findByUsuario(userId: number, desde?: string, hasta?: string): Promise<EventoCalendario[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.start_date', 'ASC');
    // Un evento entra en el rango si se solapa con él (inicio ≤ hasta y fin/inicio ≥ desde).
    if (desde) qb.andWhere('COALESCE(e.end_date, e.start_date) >= :desde', { desde: `${desde} 00:00:00` });
    if (hasta) qb.andWhere('e.start_date <= :hasta', { hasta: `${hasta} 23:59:59` });
    return (await qb.getMany()).map(toEvento);
  }

  async findById(id: number): Promise<EventoCalendario | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toEvento(row) : null;
  }

  async save(evento: EventoCalendario): Promise<EventoCalendario> {
    const p = evento.props;
    const data = {
      title: p.titulo,
      start_date: fromLocalDateTime(p.inicio) as Date,
      end_date: fromLocalDateTime(p.fin),
      all_day: p.todoElDia,
      class_name: p.clase,
      location: p.ubicacion,
      description: p.descripcion,
    };
    if (p.id) {
      await this.repo.update({ id: p.id, user_id: p.userId }, data);
      return evento;
    }
    const saved = await this.repo.save(this.repo.create({ ...data, user_id: p.userId }));
    return evento.withId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
