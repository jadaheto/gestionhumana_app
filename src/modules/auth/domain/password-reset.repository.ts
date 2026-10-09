import { PasswordReset } from './password-reset';

export abstract class PasswordResetRepository {
  /** Invalida los tokens anteriores del correo y crea uno nuevo. */
  abstract createToken(email: string, token: string, expiresAt: Date, now: Date): Promise<void>;
  abstract findByToken(token: string): Promise<PasswordReset | null>;
  abstract markUsed(token: string, now: Date): Promise<void>;
}
