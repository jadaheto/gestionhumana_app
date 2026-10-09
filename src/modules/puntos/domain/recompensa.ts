import { ValidationError } from '../../../shared/domain/domain-error';

export interface RecompensaProps {
  id: number | null;
  nombre: string;
  descripcion: string | null;
  puntosRequeridos: number;
  tipo: string;
  icono: string;
  estado: 'activo' | 'inactivo';
}

/** Recompensa del catálogo (tabla `recompensas`). */
export class Recompensa {
  private constructor(readonly props: RecompensaProps) {}

  static create(
    props: Omit<RecompensaProps, 'id' | 'icono' | 'estado'> & {
      id?: number | null;
      icono?: string | null;
      estado?: string | null;
    },
  ): Recompensa {
    const nombre = (props.nombre ?? '').trim();
    if (nombre === '') throw new ValidationError('El nombre de la recompensa es obligatorio.');
    if (!Number.isInteger(props.puntosRequeridos) || props.puntosRequeridos <= 0) {
      throw new ValidationError('Los puntos requeridos deben ser un entero mayor que cero.');
    }
    return new Recompensa({
      id: props.id ?? null,
      nombre,
      descripcion: props.descripcion?.trim() || null,
      puntosRequeridos: props.puntosRequeridos,
      tipo: (props.tipo ?? '').trim() || 'otro',
      icono: props.icono?.trim() || 'ri-gift-line',
      estado: props.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
  }

  get id() {
    return this.props.id;
  }
  get puntosRequeridos() {
    return this.props.puntosRequeridos;
  }
  get activa(): boolean {
    return this.props.estado === 'activo';
  }
}
