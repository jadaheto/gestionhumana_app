import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../config/configuration';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { Mailer } from '../../../../shared/application/ports/mailer.port';
import { TokenGenerator } from '../../../../shared/application/ports/token-generator.port';
import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { PasswordResetRepository } from '../../domain/password-reset.repository';
import { RequestPasswordResetInput } from '../dto/auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetInput, void> {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError('No se encontró ninguna cuenta con ese correo electrónico');

    const now = this.clock.now();
    const token = this.tokens.random(32);
    await this.resets.createToken(user.email, token, new Date(now.getTime() + RESET_TTL_MS), now);

    const link = `${this.config.get('frontendUrl', { infer: true })}/auth/reset-password/${token}`;
    await this.mailer.send({
      to: user.email,
      subject: 'Solicitud de restablecimiento de contraseña',
      html: `
        <p>Hola <strong>${escapeHtml(user.firstName)}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón:</p>
        <p><a href="${link}" style="background:#405189;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Restablecer mi contraseña</a></p>
        <p>Este enlace vence en <strong>1 hora</strong>.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <br><p>&mdash; Equipo Comfasucre</p>`,
    });
  }
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
