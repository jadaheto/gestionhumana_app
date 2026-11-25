import { UserRole } from '../../../../shared/domain/user-role';

export interface UsuarioDto {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  nombreCompleto: string;
  role: UserRole;
  /** Administrador que además es empleado. */
  esColaborador: boolean;
  sedeId: number | null;
  sedeNombre: string | null;
  areaId: number | null;
  areaNombre: string | null;
  cargoId: number | null;
  cargoNombre: string | null;
  estadoColaborador: string;
  profileImage: string | null;
}

export interface CreateUsuarioInput {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  esColaborador?: boolean | null;
  /** Si se omite, se genera una contraseña temporal que se devuelve una sola vez. */
  password?: string | null;
  sedeId: number | null;
  areaId: number | null;
  cargoId: number | null;
}

export interface UpdateUsuarioInput {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  esColaborador?: boolean | null;
  sedeId: number | null;
  areaId: number | null;
  cargoId: number | null;
}

/** Resultado de crear un usuario: la contraseña temporal sólo viaja aquí, una vez. */
export interface UsuarioCreadoDto extends UsuarioDto {
  temporaryPassword: string | null;
}

export interface ResetPasswordUsuarioInput {
  id: number;
  /** Contraseña indicada por el administrador (≥ 8 caracteres) o vacía para generar una temporal. */
  newPassword?: string | null;
}

export interface PasswordRestablecidaDto {
  /** Contraseña temporal generada (null si el administrador indicó una). */
  temporaryPassword: string | null;
  message: string;
}
