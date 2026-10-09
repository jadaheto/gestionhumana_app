import { ValidationError } from '../../../shared/domain/domain-error';

/** Estados canónicos de `tasks.status` (se conservan los valores del legado para compatibilidad de datos). */
export const ESTADOS_TAREA = ['Unassigned', 'To Do', 'Inprogress', 'In Reviews', 'Completed'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const PRIORIDADES_TAREA = ['Alta', 'Media', 'Baja'] as const;
export type PrioridadTarea = (typeof PRIORIDADES_TAREA)[number];

/** Equivalente a `Task_model::to_canonical_status`. */
export function estadoCanonico(valor: string | null | undefined): EstadoTarea {
  const v = (valor ?? '').trim();
  if (v === '') return 'Unassigned';
  const mapa: Record<string, EstadoTarea> = {
    new: 'To Do',
    pending: 'To Do',
    'to do': 'To Do',
    todo: 'To Do',
    inprogress: 'Inprogress',
    'in progress': 'Inprogress',
    'in reviews': 'In Reviews',
    'in review': 'In Reviews',
    completed: 'Completed',
    done: 'Completed',
    unassigned: 'Unassigned',
  };
  return mapa[v.toLowerCase()] ?? 'Unassigned';
}

export function prioridadCanonica(valor: string | null | undefined): PrioridadTarea {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'alta' || v === 'high') return 'Alta';
  if (v === 'baja' || v === 'low') return 'Baja';
  return 'Media';
}

export interface TareaProps {
  id: number | null;
  titulo: string;
  descripcion: string | null;
  proyecto: string | null;
  cliente: string | null;
  /** Texto libre "Responsable" del legado (`tasks.assigned_to`). */
  responsable: string | null;
  creadorId: number | null;
  fechaLimite: string | null;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  /** Ids de usuarios asignados (`task_assignees`). */
  asignadoIds: number[];
  createdAt: string | null;
  updatedAt: string | null;
}

export class Tarea {
  private constructor(readonly props: TareaProps) {}

  static create(
    props: Partial<Omit<TareaProps, 'estado' | 'prioridad'>> & {
      titulo: string;
      estado?: string | null;
      prioridad?: string | null;
    },
  ): Tarea {
    const titulo = (props.titulo ?? '').trim();
    if (titulo === '') throw new ValidationError('El título es obligatorio.');
    if (props.fechaLimite && !/^\d{4}-\d{2}-\d{2}$/.test(props.fechaLimite)) {
      throw new ValidationError('La fecha límite debe tener el formato YYYY-MM-DD.');
    }
    return new Tarea({
      id: props.id ?? null,
      titulo,
      descripcion: props.descripcion?.trim() || null,
      proyecto: props.proyecto?.trim() || null,
      cliente: props.cliente?.trim() || null,
      responsable: props.responsable?.trim() || null,
      creadorId: props.creadorId ?? null,
      fechaLimite: props.fechaLimite || null,
      estado: estadoCanonico(props.estado ?? 'To Do'),
      prioridad: prioridadCanonica(props.prioridad),
      asignadoIds: Array.from(new Set((props.asignadoIds ?? []).filter((id) => Number.isInteger(id) && id > 0))),
      createdAt: props.createdAt ?? null,
      updatedAt: props.updatedAt ?? null,
    });
  }

  get id() {
    return this.props.id;
  }

  /** Regla del legado (`Tasks::ensure_can_modify`): admin o creador. */
  puedeModificar(actorId: number, esAdmin: boolean): boolean {
    return esAdmin || this.props.creadorId === actorId;
  }

  withId(id: number): Tarea {
    return new Tarea({ ...this.props, id });
  }
  withEstado(estado: string): Tarea {
    return new Tarea({ ...this.props, estado: estadoCanonico(estado) });
  }
}
