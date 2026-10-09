import { ValidationError } from '../../../shared/domain/domain-error';
import { EstadoRegistro } from './sede';

export interface AreaProps {
  id: number | null;
  nombre: string;
  descripcion: string | null;
  sedeId: number | null;
  responsableId: number | null;
  estado: EstadoRegistro;
}

export class Area {
  private constructor(readonly props: AreaProps) {}

  static create(props: Omit<AreaProps, 'id'> & { id?: number | null }): Area {
    const nombre = (props.nombre ?? '').trim();
    if (nombre === '') throw new ValidationError('El nombre del área es obligatorio.');
    return new Area({
      id: props.id ?? null,
      nombre,
      descripcion: props.descripcion?.trim() || null,
      sedeId: props.sedeId ?? null,
      responsableId: props.responsableId ?? null,
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
