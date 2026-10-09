import { ValidationError } from '../../../shared/domain/domain-error';

export type EstadoRegistro = 'activo' | 'inactivo';

export interface SedeProps {
  id: number | null;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  estado: EstadoRegistro;
}

export class Sede {
  private constructor(readonly props: SedeProps) {}

  static create(props: Omit<SedeProps, 'id'> & { id?: number | null }): Sede {
    const nombre = (props.nombre ?? '').trim();
    if (nombre === '') throw new ValidationError('El nombre de la sede es obligatorio.');
    return new Sede({
      id: props.id ?? null,
      nombre,
      direccion: props.direccion?.trim() || null,
      ciudad: props.ciudad?.trim() || null,
      telefono: props.telefono?.trim() || null,
      estado: props.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
  }

  get id() {
    return this.props.id;
  }
  get nombre() {
    return this.props.nombre;
  }

  withId(id: number): Sede {
    return new Sede({ ...this.props, id });
  }
}
