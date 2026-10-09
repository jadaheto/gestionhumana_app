import { ValidationError } from '../../../shared/domain/domain-error';
import { isUserRole, UserRole } from '../../../shared/domain/user-role';

export interface UsuarioProps {
  id: number | null;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  sedeId: number | null;
  areaId: number | null;
  cargoId: number | null;
  estadoColaborador: string;
  profileImage: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cuenta de acceso al sistema (tabla `users`) vista desde la administración
 * de usuarios. Sólo expone los campos que gestiona `AdminUsuarios` en el
 * legado: identidad, rol y ubicación organizacional (sede/área/cargo).
 */
export class Usuario {
  private constructor(readonly props: UsuarioProps) {}

  static create(
    props: Omit<UsuarioProps, 'id' | 'estadoColaborador' | 'profileImage'> & {
      id?: number | null;
      estadoColaborador?: string | null;
      profileImage?: string | null;
    },
  ): Usuario {
    const username = (props.username ?? '').trim();
    const email = (props.email ?? '').trim().toLowerCase();
    const firstName = (props.firstName ?? '').trim();
    const lastName = (props.lastName ?? '').trim();
    if (username === '') throw new ValidationError('El nombre de usuario es obligatorio.');
    if (/\s/.test(username)) throw new ValidationError('El nombre de usuario no puede contener espacios.');
    if (!EMAIL_RE.test(email)) throw new ValidationError('El correo electrónico no es válido.');
    if (firstName === '') throw new ValidationError('Los nombres son obligatorios.');
    if (lastName === '') throw new ValidationError('Los apellidos son obligatorios.');
    if (!isUserRole(props.role)) throw new ValidationError('El rol debe ser "admin" o "funcionario".');
    return new Usuario({
      id: props.id ?? null,
      username,
      email,
      firstName,
      lastName,
      role: props.role,
      sedeId: props.sedeId ?? null,
      areaId: props.areaId ?? null,
      cargoId: props.cargoId ?? null,
      estadoColaborador: props.estadoColaborador || 'activo',
      profileImage: props.profileImage ?? null,
    });
  }

  get id() {
    return this.props.id;
  }
  get username() {
    return this.props.username;
  }
  get email() {
    return this.props.email;
  }
  get role() {
    return this.props.role;
  }
  get isAdmin(): boolean {
    return this.props.role === 'admin';
  }
  get nombreCompleto(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim();
  }

  withId(id: number): Usuario {
    return new Usuario({ ...this.props, id });
  }

  /** Devuelve una copia con los datos editables actualizados (el username no cambia). */
  actualizar(
    cambios: Pick<UsuarioProps, 'email' | 'firstName' | 'lastName' | 'role' | 'sedeId' | 'areaId' | 'cargoId'>,
  ): Usuario {
    return Usuario.create({ ...this.props, ...cambios });
  }
}
