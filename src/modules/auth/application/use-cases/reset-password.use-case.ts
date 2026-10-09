import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { PasswordResetRepository } from '../../domain/password-reset.repository';
import { ResetPasswordInput } from '../dto/auth.dto';

export const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class ResetPasswordUseCase implements UseCase<ResetPasswordInput, void> {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const now = this.clock.now();
    const reset = await this.resets.findByToken(input.token);
    if (!reset || !reset.isValid(now)) {
      throw new ValidationError('Enlace de restablecimiento inválido o expirado.');
    }
    if (input.newPassword !== input.confirmPassword) {
      throw new ValidationError('Las contraseñas no coinciden.');
    }
    if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    const user = await this.users.findByEmail(reset.props.email);
    if (!user) throw new ValidationError('Enlace de restablecimiento inválido o expirado.');

    await this.users.updatePasswordHash(user.id, await this.hasher.hash(input.newPassword));
    await this.resets.markUsed(input.token, now);
  }
}
