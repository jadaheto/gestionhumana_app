import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { FiltroTareas, TareaRepository } from '../../domain/repositories';
import { Tarea } from '../../domain/tarea';
import { toIso } from './fechas';
import { TaskAssigneeOrmEntity } from './task-assignee.orm-entity';
import { TaskOrmEntity } from './task.orm-entity';

const toTarea = (r: TaskOrmEntity, asignadoIds: number[]): Tarea =>
  Tarea.create({
    id: r.id,
    titulo: r.title,
    descripcion: r.description,
    proyecto: r.project_name,
    cliente: r.client_name,
    responsable: r.assigned_to,
    creadorId: r.creator_id,
    fechaLimite: r.due_date ? String(r.due_date).slice(0, 10) : null,
    estado: r.status,
    prioridad: r.priority,
    asignadoIds,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  });

@Injectable()
export class TypeOrmTareaRepository extends TareaRepository {
  constructor(
    @InjectRepository(TaskOrmEntity) private readonly tasks: Repository<TaskOrmEntity>,
    @InjectRepository(TaskAssigneeOrmEntity) private readonly assignees: Repository<TaskAssigneeOrmEntity>,
  ) {
    super();
  }

  async findAll(filtro: FiltroTareas = {}): Promise<Tarea[]> {
    const qb = this.tasks.createQueryBuilder('t').orderBy('t.due_date', 'ASC', 'NULLS LAST').addOrderBy('t.id', 'DESC');
    if (filtro.estado) qb.andWhere('t.status = :estado', { estado: filtro.estado });
    if (filtro.busqueda?.trim()) {
      const q = `%${filtro.busqueda.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('t.title ILIKE :q', { q })
            .orWhere('t.project_name ILIKE :q', { q })
            .orWhere('t.client_name ILIKE :q', { q })
            .orWhere('t.description ILIKE :q', { q }),
        ),
      );
    }
    const rows = await qb.getMany();
    const asignados = await this.asignadosDe(rows.map((r) => r.id));
    return rows.map((r) => toTarea(r, asignados.get(r.id) ?? []));
  }

  async findById(id: number): Promise<Tarea | null> {
    const row = await this.tasks.findOne({ where: { id } });
    if (!row) return null;
    return toTarea(row, (await this.asignadosDe([id])).get(id) ?? []);
  }

  async save(tarea: Tarea, now: string): Promise<Tarea> {
    const p = tarea.props;
    const data = {
      title: p.titulo,
      description: p.descripcion,
      project_name: p.proyecto,
      client_name: p.cliente,
      assigned_to: p.responsable,
      due_date: p.fechaLimite,
      status: p.estado,
      priority: p.prioridad,
      updated_at: new Date(now),
    };
    let id = p.id;
    if (id) {
      await this.tasks.update({ id }, data);
    } else {
      const saved = await this.tasks.save(
        this.tasks.create({ ...data, creator_id: p.creadorId, created_at: new Date(now) }),
      );
      id = saved.id;
    }
    await this.assignees.delete({ task_id: id });
    if (p.asignadoIds.length) {
      await this.assignees.insert(
        p.asignadoIds.map((user_id) => ({ task_id: id, user_id, assigned_at: new Date(now) })),
      );
    }
    return (await this.findById(id)) ?? tarea.withId(id);
  }

  async updateEstado(id: number, estado: string, now: string): Promise<void> {
    await this.tasks.update({ id }, { status: estado, updated_at: new Date(now) });
  }

  async delete(id: number): Promise<void> {
    await this.tasks.delete({ id });
  }

  private async asignadosDe(taskIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (taskIds.length === 0) return map;
    const rows = await this.assignees.find({ where: { task_id: In(taskIds) }, order: { id: 'ASC' } });
    for (const r of rows) map.set(r.task_id, [...(map.get(r.task_id) ?? []), r.user_id]);
    return map;
  }
}
