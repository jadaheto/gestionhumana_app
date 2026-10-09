import { ValidationError } from '../../../shared/domain/domain-error';

export const CLASES_EVENTO = [
  'bg-primary',
  'bg-primary-subtle',
  'bg-success-subtle',
  'bg-info-subtle',
  'bg-warning-subtle',
  'bg-danger-subtle',
  'bg-dark-subtle',
] as const;

/**
 * Normaliza una fecha de entrada al formato local `YYYY-MM-DDTHH:mm:ss`
 * (equivale a `Calendar::normalizeDate`: sin hora → medianoche).
 */
export function normalizarFechaHora(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  if (v === '') return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  if (!m) return null;
  const fecha = m[1];
  if (!m[2]) return `${fecha}T00:00:00`;
  const hh = Number(m[2]);
  const mi = Number(m[3]);
  if (hh > 23 || mi > 59) return null;
  return `${fecha}T${m[2]}:${m[3]}:${m[4] ?? '00'}`;
}

export interface EventoCalendarioProps {
  id: number | null;
  userId: number;
  titulo: string;
  inicio: string;
  fin: string | null;
  todoElDia: boolean;
  clase: string;
  ubicacion: string | null;
  descripcion: string | null;
}

export class EventoCalendario {
  private constructor(readonly props: EventoCalendarioProps) {}

  static create(
    props: Omit<EventoCalendarioProps, 'id' | 'inicio' | 'fin' | 'clase' | 'todoElDia'> & {
      id?: number | null;
      inicio: string;
      fin?: string | null;
      clase?: string | null;
      todoElDia?: boolean;
    },
  ): EventoCalendario {
    const titulo = (props.titulo ?? '').trim();
    if (titulo === '') throw new ValidationError('El nombre del evento es obligatorio.');
    const inicio = normalizarFechaHora(props.inicio);
    if (!inicio) throw new ValidationError('La fecha de inicio es obligatoria y debe ser válida.');
    const fin = props.fin ? normalizarFechaHora(props.fin) : null;
    if (props.fin && !fin) throw new ValidationError('La fecha de fin no es válida.');
    if (fin && fin < inicio) throw new ValidationError('La fecha de fin no puede ser anterior a la de inicio.');
    return new EventoCalendario({
      id: props.id ?? null,
      userId: props.userId,
      titulo,
      inicio,
      fin,
      todoElDia: props.todoElDia ?? false,
      clase: props.clase?.trim() || 'bg-primary',
      ubicacion: props.ubicacion?.trim() || null,
      descripcion: props.descripcion?.trim() || null,
    });
  }

  get id() {
    return this.props.id;
  }
  withId(id: number): EventoCalendario {
    return new EventoCalendario({ ...this.props, id });
  }
}
