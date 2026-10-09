import { AuthUser, UiPreferences } from './auth-user';

/** Puerto de persistencia del contexto de autenticación. */
export abstract class AuthUserRepository {
  abstract findByUsernameOrEmail(identifier: string): Promise<AuthUser | null>;
  abstract findByEmail(email: string): Promise<AuthUser | null>;
  abstract findById(id: number): Promise<AuthUser | null>;
  abstract updateEstadoColaborador(userId: number, estado: 'activo' | 'inactivo'): Promise<void>;
  abstract updatePasswordHash(userId: number, hash: string): Promise<void>;
  abstract updateUiPreferences(userId: number, prefs: UiPreferences): Promise<void>;
}
