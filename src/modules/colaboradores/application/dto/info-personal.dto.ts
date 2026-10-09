import { Actor } from '../../../../shared/domain/actor';
import {
  DatosBasicos,
  DatosBasicosProps,
  EducacionFormalProps,
  EducacionNoFormalProps,
  ExperienciaLaboralProps,
  FamiliarProps,
  Nullable,
} from '../../domain/info-personal';

/** Entrada común de lectura: el admin puede consultar a otro usuario con `userId`. */
export interface OwnedQueryInput {
  actor: Actor;
  userId?: number;
}

export type DatosBasicosDto = DatosBasicos;
export interface UpdateDatosBasicosInput {
  actor: Actor;
  datos: Partial<Nullable<DatosBasicosProps>>;
}

type WithId<T> = Omit<T, 'id'> & { id: number };
export type EducacionFormalDto = WithId<EducacionFormalProps>;
export type EducacionNoFormalDto = WithId<EducacionNoFormalProps>;
export type FamiliarDto = WithId<FamiliarProps>;
export type ExperienciaLaboralDto = WithId<ExperienciaLaboralProps>;

export interface SaveOwnedInput<TData> {
  actor: Actor;
  id?: number;
  data: TData;
}

export interface DeleteOwnedInput {
  actor: Actor;
  id: number;
}

export type SaveEducacionFormalInput = SaveOwnedInput<Nullable<Omit<EducacionFormalProps, 'id' | 'userId'>>>;
export type SaveEducacionNoFormalInput = SaveOwnedInput<
  Nullable<Omit<EducacionNoFormalProps, 'id' | 'userId' | 'certificado'>>
> & {
  certificado?: { content: Buffer; originalName: string; mimeType: string } | null;
};
export type SaveFamiliarInput = SaveOwnedInput<Nullable<Omit<FamiliarProps, 'id' | 'userId'>>>;
export type SaveExperienciaLaboralInput = SaveOwnedInput<Nullable<Omit<ExperienciaLaboralProps, 'id' | 'userId'>>>;
