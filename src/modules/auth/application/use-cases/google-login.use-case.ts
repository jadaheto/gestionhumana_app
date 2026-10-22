import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { ActiveContractChecker } from '../../domain/active-contract-checker.port';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { LoginHistoryRepository } from '../../domain/login-history.repository';
import { LoginOutput } from '../dto/auth.dto';
import { GoogleIdentityProvider, GoogleProfile } from '../google-identity.port';
import { TokenIssuer } from '../token-issuer.port';
import { startSession } from './login.use-case';

export interface GoogleLoginInput {
  profile: GoogleProfile;
  device: string;
  ipAddress: string;
}

/**
 * Ingreso con Google. La lista de acceso es la tabla de usuarios: solo entra un
 * correo verificado, del dominio permitido y registrado por el administrador.
 */
@Injectable()
export class GoogleLoginUseCase implements UseCase<GoogleLoginInput, LoginOutput> {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly contracts: ActiveContractChecker,
    private readonly history: LoginHistoryRepository,
    private readonly tokens: TokenIssuer,
    private readonly google: GoogleIdentityProvider,
  ) {}

  async execute(input: GoogleLoginInput): Promise<LoginOutput> {
    const { profile } = input;
    if (!profile.emailVerified) throw new UnauthorizedError('La cuenta de Google no tiene el correo verificado.');

    const domain = this.google.workspaceDomain();
    if (domain && profile.email.split('@')[1] !== domain) {
      throw new UnauthorizedError(`Solo se permiten cuentas @${domain}.`);
    }

    const user = await this.users.findByEmail(profile.email);
    if (!user) {
      throw new UnauthorizedError(
        `El correo ${profile.email} no tiene acceso a Gestión Humana. Pídele al administrador que lo registre.`,
      );
    }

    const { users, contracts, history, tokens } = this;
    return startSession(user, input, { users, contracts, history, tokens });
  }
}
