import { UserRole } from '../../../shared/domain/user-role';

/** Preferencias de interfaz persistidas en `users.ui_preferences` (JSONB). */
export type UiPreferences = Record<string, string>;

export const DEFAULT_UI_PREFERENCES: UiPreferences = { language: 'es', theme: 'light' };

export interface AuthUserProps {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** 'activo' | 'inactivo' | 'retirado' (la columna no tiene CHECK, por eso es string). */
  estadoColaborador: string;
  profileImage: string | null;
  uiPreferences: UiPreferences;
}

/**
 * Agregado de autenticación. Expone únicamente lo que el contexto de
 * autenticación necesita del usuario.
 */
export class AuthUser {
  private constructor(private readonly props: AuthUserProps) {}

  static create(props: AuthUserProps): AuthUser {
    return new AuthUser({ ...props, uiPreferences: { ...DEFAULT_UI_PREFERENCES, ...props.uiPreferences } });
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
  get passwordHash() {
    return this.props.passwordHash;
  }
  get firstName() {
    return this.props.firstName;
  }
  get lastName() {
    return this.props.lastName;
  }
  get role() {
    return this.props.role;
  }
  get estadoColaborador() {
    return this.props.estadoColaborador;
  }
  get profileImage() {
    return this.props.profileImage;
  }
  get uiPreferences(): UiPreferences {
    return { ...this.props.uiPreferences };
  }

  get isAdmin(): boolean {
    return this.props.role === 'admin';
  }

  get isRetirado(): boolean {
    return this.props.estadoColaborador === 'retirado';
  }

  /**
   * Regla de negocio heredada: un funcionario sólo puede acceder si tiene un
   * contrato activo vigente; los administradores siempre pueden. Un
   * colaborador retirado nunca accede.
   */
  canAccessPlatform(hasActiveContract: boolean): boolean {
    if (this.isAdmin) return true;
    if (this.isRetirado) return false;
    return hasActiveContract;
  }

  /** Estado que debe reflejar `estado_colaborador` según la vigencia del contrato. */
  expectedEstado(hasActiveContract: boolean): 'activo' | 'inactivo' {
    return hasActiveContract ? 'activo' : 'inactivo';
  }
}
