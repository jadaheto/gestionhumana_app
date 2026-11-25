import { ValidationError } from '../../../shared/domain/domain-error';
import { EstadoRegistro } from './sede';

export interface AreaProps {
  id: number | null;
  nombre: string;
  descripcion: string | null;
  sedeId: number | null;
  responsableId: number | null;
  /** Área de la que depende en el organigrama (null = raíz). */
  padreId: number | null;
  /** Posición entre sus hermanas en el organigrama. */
  orden: number;
  estado: EstadoRegistro;
}

export class Area {
  private constructor(readonly props: AreaProps) {}

  static create(
    props: Omit<AreaProps, 'id' | 'padreId' | 'orden'> & {
      id?: number | null;
      padreId?: number | null;
      orden?: number;
    },
  ): Area {
    const nombre = (props.nombre ?? '').trim();
    if (nombre === '') throw new ValidationError('El nombre del área es obligatorio.');
    return new Area({
      id: props.id ?? null,
      nombre,
      descripcion: props.descripcion?.trim() || null,
      sedeId: props.sedeId ?? null,
      responsableId: props.responsableId ?? null,
      padreId: props.padreId ?? null,
      orden: Math.max(0, Math.trunc(props.orden ?? 0)),
      estado: props.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
  }

  get id() {
    return this.props.id;
  }

  withId(id: number): Area {
    return new Area({ ...this.props, id });
  }
}
