import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../../../config/configuration';
import { InvalidOperationError, UnauthorizedError } from '../../../../shared/domain/domain-error';
import { GoogleIdentityProvider, GoogleProfile } from '../../application/google-identity.port';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_TTL = '10m';
const TIMEOUT_MS = 15000;

interface OAuthState {
  n: string;
  returnUrl?: string;
}

/** Adaptador OAuth 2.0 de Google con `fetch`; el `state` es un JWT corto firmado con la clave de la API. */
@Injectable()
export class GoogleOAuthProvider extends GoogleIdentityProvider {
  private readonly logger = new Logger(GoogleOAuthProvider.name);
  private readonly cfg: AppConfig['google'];

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    super();
    this.cfg = config.get('google', { infer: true });
  }

  isEnabled(): boolean {
    return !!this.cfg.clientId && !!this.cfg.clientSecret && !!this.cfg.callbackUrl;
  }

  workspaceDomain(): string {
    return this.cfg.workspaceDomain;
  }

  async authorizationUrl(returnUrl?: string): Promise<string> {
    if (!this.isEnabled()) throw new InvalidOperationError('El ingreso con Google no está configurado.');
    const payload: OAuthState = { n: randomBytes(12).toString('hex') };
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//'))
      payload.returnUrl = returnUrl.slice(0, 300);
    const state = await this.jwt.signAsync(payload, { expiresIn: STATE_TTL });
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });
    if (this.cfg.workspaceDomain) params.set('hd', this.cfg.workspaceDomain);
    return `${GOOGLE_AUTH}?${params.toString()}`;
  }

  async readState(state: string): Promise<{ returnUrl: string }> {
    try {
      const payload = await this.jwt.verifyAsync<OAuthState>(state);
      return { returnUrl: payload.returnUrl ?? '/dashboard' };
    } catch {
      throw new UnauthorizedError('La solicitud de ingreso con Google venció o no es válida. Intenta de nuevo.');
    }
  }

  async profileFromCode(code: string): Promise<GoogleProfile> {
    let tokenRes: Response;
    try {
      tokenRes = await fetch(GOOGLE_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          redirect_uri: this.cfg.callbackUrl,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.warn(`No se pudo contactar a Google: ${e instanceof Error ? e.message : String(e)}`);
      throw new UnauthorizedError('No se pudo contactar a Google. Intenta de nuevo.');
    }
    const token = (await tokenRes.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;
    if (!tokenRes.ok || !token?.access_token) {
      this.logger.warn(
        `Google rechazó el código: ${token?.error ?? tokenRes.status} ${token?.error_description ?? ''}`,
      );
      throw new UnauthorizedError('Google no aceptó el inicio de sesión. Intenta de nuevo.');
    }
    const infoRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const info = (await infoRes.json().catch(() => null)) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    } | null;
    if (!infoRes.ok || !info?.email) throw new UnauthorizedError('Google no entregó el correo de la cuenta.');
    return {
      email: info.email.trim().toLowerCase(),
      emailVerified: info.email_verified === true,
      name: info.name ?? null,
    };
  }
}
