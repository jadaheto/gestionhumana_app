import { ColaboradorDirectorio } from '../../domain/directorio';
import { NodoDependencia } from '../../domain/dependencias';
import { NodoOrganigrama } from '../../domain/organigrama';

export interface JerarquiaDto {
  /** `false` cuando la tabla `organigrama` está vacía ("Organigrama no configurado"). */
  configurado: boolean;
  totalCargos: number;
  raiz: NodoOrganigrama | null;
}

export interface OrganigramaDependenciasDto {
  /** `false` cuando no hay áreas activas. */
  configurado: boolean;
  totalDependencias: number;
  raices: NodoDependencia[];
}

export type ColaboradorDirectorioDto = ColaboradorDirectorio;

export interface ImportarCargosInput {
  dataset: string;
}

export interface ImportacionCargosResultadoDto {
  areasCreadas: number;
  cargosCreados: number;
  salariosGuardados: number;
  filasOmitidas: number;
  filasProcesadas: number;
  message: string;
}
