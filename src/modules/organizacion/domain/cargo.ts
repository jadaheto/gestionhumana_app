import { ValidationError } from '../../../shared/domain/domain-error';
import { EstadoRegistro } from './sede';

/** 1=Director, 2=Jefe, 3=Coordinador, 4=Analista, 5=Auxiliar */
export const NIVELES_JERARQUICOS: Record<number, string> = {
  1: 'Director',
  2: 'Jefe',
  3: 'Coordinador',
  4: 'Analista',
  5: 'Auxiliar',
};

export interface CargoProps {
  id: number | null;
  nombre: string;
  descripcion: string | null;
  areaId: number | null;
  nivelJerarquico: number;
  funciones: string | null;
  estado: EstadoRegistro;
}

export class Cargo {
  private constructor(readonly props: CargoProps) {}

  static create(
    props: Omit<CargoProps, 'id' | 'nivelJerarquico'> & { id?: number | null; nivelJerarquico?: number | null },
  ): Cargo {
    const nombre = (props.nombre ?? '').trim();
    if (nombre === '') throw new ValidationError('El nombre del cargo es obligatorio.');
    const nivel = props.nivelJerarquico ?? 5;
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) {
      throw new ValidationError('El nivel jerárquico debe estar entre 1 (Director) y 5 (Auxiliar).');
    }
    return new Cargo({
      id: props.id ?? null,
      nombre,
      descripcion: props.descripcion?.trim() || null,
      areaId: props.areaId ?? null,
      nivelJerarquico: nivel,
      funciones: props.funciones?.trim() || null,
      estado: props.estado === 'inactivo' ? 'inactivo' : 'activo',
    });
  }

  get id() {
    return this.props.id;
  }
  get nivelNombre(): string {
    return NIVELES_JERARQUICOS[this.props.nivelJerarquico] ?? 'Auxiliar';
  }

  withId(id: number): Cargo {
    return new Cargo({ ...this.props, id });
  }
}
