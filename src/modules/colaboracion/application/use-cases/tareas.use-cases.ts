import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import { NotificacionesPort } from '../../domain/notificaciones.port';
import { FiltroTareas, TareaRepository } from '../../domain/repositories';
import { ESTADOS_TAREA, EstadoTarea, Tarea, estadoCanonico } from '../../domain/tarea';
import { UsuariosPort } from '../../domain/usuarios.port';
import { EstadisticasTareasDto, GuardarTareaInput, KanbanDto, TareaDto } from '../dto/colaboracion.dto';

async function toDtos(tareas: Tarea[], actor: Actor, usuarios: UsuariosPort): Promise<TareaDto[]> {
  const ids = Array.from(new Set(tareas.flatMap((t) => t.props.asignadoIds)));
  const nombres = ids.length ? await usuarios.nombresPorIds(ids) : new Map<number, string>();
  return tareas.map((t) => toDto(t, actor, nombres));
}

export function toDto(t: Tarea, actor: Actor, nombres: Map<number, string>): TareaDto {
  const p = t.props;
  return {
    id: p.id ?? 0,
    titulo: p.titulo,
    descripcion: p.descripcion,
    proyecto: p.proyecto,
    cliente: p.cliente,
    responsable: p.responsable,
    creadorId: p.creadorId,
    fechaLimite: p.fechaLimite,
    estado: p.estado,
    prioridad: p.prioridad,
    asignados: p.asignadoIds.map((id) => ({ id, nombre: nombres.get(id) ?? `Usuario #${id}` })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    puedeModificar: t.puedeModificar(actor.id, isAdmin(actor)),
  };
}

@Injectable()
export class ListTareasUseCase implements UseCase<{ actor: Actor; filtro?: FiltroTareas }, TareaDto[]> {
  constructor(
    private readonly tareas: TareaRepository,
    private readonly usuarios: UsuariosPort,
  ) {}
  async execute(input: { actor: Actor; filtro?: FiltroTareas }): Promise<TareaDto[]> {
    return toDtos(await this.tareas.findAll(input.filtro), input.actor, this.usuarios);
  }
}

/** Tablero agrupado por estado (`Task_model::get_tasks_by_status`). */
@Injectable()
export class GetKanbanUseCase implements UseCase<Actor, KanbanDto> {
  constructor(
    private readonly tareas: TareaRepository,
    private readonly usuarios: UsuariosPort,
  ) {}
  async execute(actor: Actor): Promise<KanbanDto> {
    const dtos = await toDtos(await this.tareas.findAll(), actor, this.usuarios);
    const grupos = Object.fromEntries(ESTADOS_TAREA.map((e) => [e, [] as TareaDto[]])) as KanbanDto;
    for (const t of dtos) grupos[t.estado].push(t);
    return grupos;
  }
}

/** Contadores por estado (`Task_model::get_task_stats`). */
@Injectable()
export class GetEstadisticasTareasUseCase implements UseCase<void, EstadisticasTareasDto> {
  constructor(private readonly tareas: TareaRepository) {}
  async execute(): Promise<EstadisticasTareasDto> {
    const todas = await this.tareas.findAll();
    const cuenta = (e: EstadoTarea) => todas.filter((t) => t.props.estado === e).length;
    return {
      total: todas.length,
      sinAsignar: cuenta('Unassigned'),
      porHacer: cuenta('To Do'),
      enProgreso: cuenta('Inprogress'),
      enRevision: cuenta('In Reviews'),
      completadas: cuenta('Completed'),
    };
  }
}

@Injectable()
export class GetTareaUseCase implements UseCase<{ actor: Actor; id: number }, TareaDto> {
  constructor(
    private readonly tareas: TareaRepository,
    private readonly usuarios: UsuariosPort,
  ) {}
  async execute(input: { actor: Actor; id: number }): Promise<TareaDto> {
    const tarea = await this.tareas.findById(input.id);
    if (!tarea) throw new NotFoundError('Tarea', input.id);
    return (await toDtos([tarea], input.actor, this.usuarios))[0];
  }
}

/**
 * Crea o actualiza una tarea. Sólo el admin o el creador pueden modificarla.
 * Notifica a los usuarios recién asignados (distintos del actor).
 */
@Injectable()
export class GuardarTareaUseCase implements UseCase<{ actor: Actor; input: GuardarTareaInput }, TareaDto> {
  constructor(
    private readonly tareas: TareaRepository,
    private readonly usuarios: UsuariosPort,
    private readonly notificaciones: NotificacionesPort,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: { actor: Actor; input: GuardarTareaInput }): Promise<TareaDto> {
    const now = this.clock.now().toISOString();
    let existente: Tarea | null = null;
    if (input.id) {
      existente = await this.tareas.findById(input.id);
      if (!existente) throw new NotFoundError('Tarea', input.id);
      if (!existente.puedeModificar(actor.id, isAdmin(actor))) {
        throw new ForbiddenError('No tienes permiso para modificar esta tarea.');
      }
    }
    const asignadoIds = input.asignadoIds ?? existente?.props.asignadoIds ?? [];
    for (const id of asignadoIds) {
      if (!(await this.usuarios.existe(id))) throw new NotFoundError('Usuario asignado', id);
    }
    const tarea = Tarea.create({
      id: existente?.id ?? null,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      proyecto: input.proyecto ?? null,
      cliente: input.cliente ?? null,
      responsable: input.responsable ?? null,
      creadorId: existente?.props.creadorId ?? actor.id,
      fechaLimite: input.fechaLimite ?? null,
      estado: estadoCanonico(input.estado ?? existente?.props.estado ?? 'To Do'),
      prioridad: input.prioridad ?? existente?.props.prioridad ?? 'Media',
      asignadoIds,
      createdAt: existente?.props.createdAt ?? now,
      updatedAt: now,
    });
    const guardada = await this.tareas.save(tarea, now);

    const previos = new Set(existente?.props.asignadoIds ?? []);
    const nuevos = guardada.props.asignadoIds.filter((id) => !previos.has(id) && id !== actor.id);
    for (const userId of nuevos) {
      await this.notificaciones.crear(
        {
          userId,
          titulo: 'Nueva tarea asignada',
          mensaje: `${actorFullName(actor)} te asignó la tarea "${guardada.props.titulo}".`,
          tipo: 'tarea',
          link: `/tareas/${guardada.id}`,
        },
        now,
      );
    }
    return (await toDtos([guardada], actor, this.usuarios))[0];
  }
}

@Injectable()
export class CambiarEstadoTareaUseCase implements UseCase<{ actor: Actor; id: number; estado: string }, TareaDto> {
  constructor(
    private readonly tareas: TareaRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
  ) {}
  async execute({ actor, id, estado }: { actor: Actor; id: number; estado: string }): Promise<TareaDto> {
    const tarea = await this.tareas.findById(id);
    if (!tarea) throw new NotFoundError('Tarea', id);
    if (!tarea.puedeModificar(actor.id, isAdmin(actor)))
      throw new ForbiddenError('No tienes permiso para modificar esta tarea.');
    const now = this.clock.now().toISOString();
    await this.tareas.updateEstado(id, estadoCanonico(estado), now);
    return (await toDtos([tarea.withEstado(estado)], actor, this.usuarios))[0];
  }
}

@Injectable()
export class EliminarTareaUseCase implements UseCase<{ actor: Actor; id: number }, void> {
  constructor(private readonly tareas: TareaRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<void> {
    const tarea = await this.tareas.findById(id);
    if (!tarea) throw new NotFoundError('Tarea', id);
    if (!tarea.puedeModificar(actor.id, isAdmin(actor)))
      throw new ForbiddenError('No tienes permiso para eliminar esta tarea.');
    await this.tareas.delete(id);
  }
}
