import { ValidationError } from '../../../shared/domain/domain-error';
import { parseIsoDate } from './dias-habiles.calculator';

/** Tipos de incapacidad (los del formulario legado más `paternidad` del esquema). */
export const TIPOS_INCAPACIDAD = [
  'enfermedad_general',
  'accidente_laboral',
  'maternidad',
  'paternidad',
  'otra',
] as const;
export type TipoIncapacidad = (typeof TIPOS_INCAPACIDAD)[number];

export function isTipoIncapacidad(value: unknown): value is TipoIncapacidad {
  return typeof value === 'string' && (TIPOS_INCAPACIDAD as readonly string[]).includes(value);
}

export interface IncapacidadProps {
  id: number | null;
  userId: number;
  tipo: TipoIncapacidad;
  /** `YYYY-MM-DD` */
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  entidadEmisora: string | null;
  numeroIncapacidad: string | null;
  archivoSoporte: string | null;
  estado: string;
  createdAt: string | null;
}

export type NuevaIncapacidadProps = {
  userId: number;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  dias?: number | null;
  entidadEmisora?: string | null;
  numeroIncapacidad?: string | null;
  archivoSoporte?: string | null;
};

/** Incapacidad médica registrada (tabla `incapacidades`). */
export class Incapacidad {
  private constructor(readonly props: IncapacidadProps) {}

  static create(props: NuevaIncapacidadProps): Incapacidad {
    if (!Number.isInteger(props.userId) || props.userId <= 0) {
      throw new ValidationError('Debes seleccionar el colaborador.');
    }
    if (!isTipoIncapacidad(props.tipo)) {
      throw new ValidationError('Tipo de incapacidad inválido.');
    }
    const inicio = parseIsoDate(props.fechaInicio);
    const fin = parseIsoDate(props.fechaFin);
    if (inicio === null || fin === null || fin < inicio) {
      throw new ValidationError('Las fechas de la incapacidad no son válidas.');
    }
    // Si no se indican días, se calculan como días calendario inclusivos.
    const dias = props.dias ?? Math.round((fin - inicio) / 86_400_000) + 1;
    if (!Number.isInteger(dias) || dias < 1) {
      throw new ValidationError('Los días de incapacidad deben ser al menos 1.');
    }
    return new Incapacidad({
      id: null,
      userId: props.userId,
      tipo: props.tipo,
      fechaInicio: props.fechaInicio.slice(0, 10),
      fechaFin: props.fechaFin.slice(0, 10),
      dias,
      entidadEmisora: props.entidadEmisora?.trim() || null,
      numeroIncapacidad: props.numeroIncapacidad?.trim() || null,
      archivoSoporte: props.archivoSoporte?.trim() || null,
      estado: 'activo',
      createdAt: null,
    });
  }

  static rehydrate(props: IncapacidadProps): Incapacidad {
    return new Incapacidad(props);
  }

  get id(): number | null {
    return this.props.id;
  }

  withId(id: number): Incapacidad {
    return new Incapacidad({ ...this.props, id });
  }
}
