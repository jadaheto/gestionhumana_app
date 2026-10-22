import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { ActiveContractChecker } from '../../domain/active-contract-checker.port';
import { AuthUser } from '../../domain/auth-user';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { LoginHistoryRepository } from '../../domain/login-history.repository';
import { LoginInput, LoginOutput } from '../dto/auth.dto';
import { TokenIssuer } from '../token-issuer.port';

export const INACTIVE_USER_MESSAGE =
  'Tu usuario está inactivo porque no tienes contratos activos. Comunícate con Gestión Humana.';
export const INVALID_CREDENTIALS_MESSAGE = 'Las credenciales no coinciden con nuestros registros.';

@Injectable()
export class LoginUseCase implements UseCase<LoginInput, LoginOutput> {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly contracts: ActiveContractChecker,
    private readonly history: LoginHistoryRepository,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.users.findByUsernameOrEmail(input.identifier.trim());
    if (!user) throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);

    const ok = await this.hasher.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);

    const { users, contracts, history, tokens } = this;
    return startSession(user, input, { users, contracts, history, tokens });
  }
}

/** Dependencias para abrir la sesión de un usuario ya identificado. */
export interface SessionDeps {
  users: AuthUserRepository;
  contracts: ActiveContractChecker;
  history: LoginHistoryRepository;
  tokens: TokenIssuer;
}

/**
 * Reglas comunes a todo método de ingreso: sincroniza `estado_colaborador` con
 * la vigencia del contrato, valida el acceso, registra el historial y emite el token.
 */
export async function startSession(
  user: AuthUser,
  ctx: { device: string; ipAddress: string },
  deps: SessionDeps,
): Promise<LoginOutput> {
  const hasContract = user.isAdmin ? true : await deps.contracts.hasActiveContract(user.id);
  if (!user.isAdmin && !user.isRetirado) {
    const expected = user.expectedEstado(hasContract);
    if (user.estadoColaborador !== expected) {
      await deps.users.updateEstadoColaborador(user.id, expected);
    }
  }
  if (!user.canAccessPlatform(hasContract)) {
    throw new UnauthorizedError(INACTIVE_USER_MESSAGE);
  }

  await deps.history.record({
    userId: user.id,
    device: ctx.device,
    location: 'Unknown',
    ipAddress: ctx.ipAddress,
  });

  const accessToken = await deps.tokens.issue(toActor(user));
  return {
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage,
      uiPreferences: user.uiPreferences,
    },
  };
}

export function toActor(user: AuthUser): Actor {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
}
