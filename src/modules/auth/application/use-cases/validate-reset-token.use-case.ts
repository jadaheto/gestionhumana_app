import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { PasswordResetRepository } from '../../domain/password-reset.repository';

@Injectable()
export class ValidateResetTokenUseCase implements UseCase<string, { valid: boolean }> {
  constructor(
    private readonly resets: PasswordResetRepository,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<{ valid: boolean }> {
    const reset = await this.resets.findByToken(token);
    return { valid: !!reset && reset.isValid(this.clock.now()) };
  }
}
