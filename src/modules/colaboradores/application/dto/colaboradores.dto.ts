import { Actor } from '../../../../shared/domain/actor';
import { CreateColaboradorProps } from '../../domain/colaborador';
import { ContratoActivo } from '../../domain/ports';

export interface ColaboradorDto {
  id: number;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  fullName: string;
  cedula: string;
  codigoEmpresa: string | null;
  phoneNumber: string | null;
  telefono: string | null;
  celular: string | null;
  sedeId: number | null;
  areaId: number | null;
  cargoId: number | null;
  estadoColaborador: string;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  genero: string | null;
  estadoCivil: string | null;
  direccion: string | null;
  eps: string | null;
  arl: string | null;
  fondoPension: string | null;
  cajaCompensacion: string | null;
  tipoSangre: string | null;
  designation: string | null;
  profileImage: string | null;
  numeroHijos: number;
}

/** Fila del listado: incluye los nombres de sede/área/cargo. */
export interface ColaboradorListadoDto extends ColaboradorDto {
  sedeNombre: string | null;
  areaNombre: string | null;
  cargoNombre: string | null;
}

export interface ColaboradorDetalleDto extends ColaboradorListadoDto {
  cargoFunciones: string | null;
  contratoActivo: ContratoActivo | null;
}

export interface ColaboradorCreadoDto {
  colaborador: ColaboradorDto;
  username: string;
  /** Sólo se devuelve cuando el sistema la generó; no se vuelve a mostrar. */
  temporaryPassword: string | null;
}

export type SaveColaboradorInput = Omit<
  CreateColaboradorProps,
  'id' | 'username' | 'role' | 'profileImage' | 'numeroHijos'
> & {
  username?: string | null;
  password?: string | null;
};

export interface ListColaboradoresInput {
  estado?: string;
  areaId?: number;
  sedeId?: number;
}

export interface DeleteColaboradorInput {
  actor: Actor;
  id: number;
}

export interface UploadFotoColaboradorInput {
  id: number;
  content: Buffer;
  originalName: string;
  mimeType: string;
}
