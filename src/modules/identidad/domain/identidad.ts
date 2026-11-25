import { ValidationError } from '../../../shared/domain/domain-error';

/** Campos de la tabla `identidad_empresa` (columna `campo`). */
export const CAMPOS_IDENTIDAD = ['mision', 'vision', 'valores', 'principios', 'himno_url'] as const;
export type CampoIdentidad = (typeof CAMPOS_IDENTIDAD)[number];

export function esCampoIdentidad(value: string): value is CampoIdentidad {
  return (CAMPOS_IDENTIDAD as readonly string[]).includes(value);
}

export interface IdentidadCampo {
  campo: CampoIdentidad;
  contenido: string;
  /** texto | video | imagen */
  tipo: string;
  orden: number;
  updatedAt: Date | null;
}

/** Contenido de la identidad empresarial indexado por campo. */
export type IdentidadEmpresa = Record<CampoIdentidad, string>;

/** Valida la URL del himno (debe ser http(s) o vacía). */
export function validarHimnoUrl(value: string): string {
  const v = value.trim();
  if (v === '') return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
  } catch {
    throw new ValidationError('La URL del himno debe ser una dirección http(s) válida.');
  }
  return v;
}

export abstract class IdentidadRepository {
  abstract findAll(): Promise<IdentidadCampo[]>;
  /** Crea o actualiza el contenido de un campo. */
  abstract save(campo: CampoIdentidad, contenido: string): Promise<void>;
}
