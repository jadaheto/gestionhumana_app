import { ActiveContractChecker } from '../../../domain/active-contract-checker.port';
import { AuthUser, AuthUserProps, UiPreferences } from '../../../domain/auth-user';
import { AuthUserRepository } from '../../../domain/auth-user.repository';
import { LoginHistoryEntry, LoginHistoryRepository } from '../../../domain/login-history.repository';
import { PasswordReset } from '../../../domain/password-reset';
import { PasswordResetRepository } from '../../../domain/password-reset.repository';
import { GoogleIdentityProvider, GoogleProfile } from '../../google-identity.port';
import { TokenIssuer } from '../../token-issuer.port';
import { Actor } from '../../../../../shared/domain/actor';

export function buildUser(overrides: Partial<AuthUserProps> = {}): AuthUser {
  return AuthUser.create({
    id: 2,
    username: 'jperez',
    email: 'jperez@comfasucre.com.co',
    passwordHash: 'hashed:secreto123',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'funcionario',
    estadoColaborador: 'activo',
    profileImage: null,
    uiPreferences: { language: 'es', theme: 'light' },
    ...overrides,
  });
}

export class InMemoryAuthUserRepository extends AuthUserRepository {
  users: AuthUser[] = [];
  estadoUpdates: Array<{ userId: number; estado: string }> = [];
  passwordUpdates: Array<{ userId: number; hash: string }> = [];
  prefsUpdates: Array<{ userId: number; prefs: UiPreferences }> = [];

  findByUsernameOrEmail(identifier: string): Promise<AuthUser | null> {
    const matches = this.users.filter((u) => u.username === identifier || u.email === identifier);
    return Promise.resolve(matches.length === 1 ? matches[0] : null);
  }
  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null);
  }
  findById(id: number): Promise<AuthUser | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }
  updateEstadoColaborador(userId: number, estado: 'activo' | 'inactivo'): Promise<void> {
    this.estadoUpdates.push({ userId, estado });
    return Promise.resolve();
  }
  updatePasswordHash(userId: number, hash: string): Promise<void> {
    this.passwordUpdates.push({ userId, hash });
    return Promise.resolve();
  }
  updateUiPreferences(userId: number, prefs: UiPreferences): Promise<void> {
    this.prefsUpdates.push({ userId, prefs });
    return Promise.resolve();
  }
}

export class InMemoryPasswordResetRepository extends PasswordResetRepository {
  resets: PasswordReset[] = [];
  createToken(email: string, token: string, expiresAt: Date, now: Date): Promise<void> {
    this.resets = this.resets.map((r) =>
      r.props.email === email && r.props.usedAt === null ? new PasswordReset({ ...r.props, usedAt: now }) : r,
    );
    this.resets.push(new PasswordReset({ id: this.resets.length + 1, email, token, expiresAt, usedAt: null }));
    return Promise.resolve();
  }
  findByToken(token: string): Promise<PasswordReset | null> {
    return Promise.resolve(this.resets.find((r) => r.props.token === token) ?? null);
  }
  markUsed(token: string, now: Date): Promise<void> {
    this.resets = this.resets.map((r) =>
      r.props.token === token ? new PasswordReset({ ...r.props, usedAt: now }) : r,
    );
    return Promise.resolve();
  }
}

export class InMemoryLoginHistoryRepository extends LoginHistoryRepository {
  entries: LoginHistoryEntry[] = [];
  record(entry: LoginHistoryEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
  findRecent(userId: number, limit: number): Promise<LoginHistoryEntry[]> {
    return Promise.resolve(this.entries.filter((e) => e.userId === userId).slice(-limit));
  }
}

export class StubContractChecker extends ActiveContractChecker {
  constructor(private readonly active: Set<number> = new Set()) {
    super();
  }
  hasActiveContract(userId: number): Promise<boolean> {
    return Promise.resolve(this.active.has(userId));
  }
}

export class StubTokenIssuer extends TokenIssuer {
  issue(actor: Actor): Promise<string> {
    return Promise.resolve(`jwt-for-${actor.id}`);
  }
}

export class StubGoogleIdentityProvider extends GoogleIdentityProvider {
  constructor(private readonly domain = '') {
    super();
  }
  isEnabled(): boolean {
    return true;
  }
  workspaceDomain(): string {
    return this.domain;
  }
  authorizationUrl(): Promise<string> {
    return Promise.resolve('https://accounts.google.com/o/oauth2/v2/auth');
  }
  readState(): Promise<{ returnUrl: string }> {
    return Promise.resolve({ returnUrl: '/dashboard' });
  }
  profileFromCode(): Promise<GoogleProfile> {
    return Promise.resolve({ email: 'jperez@comfasucre.com.co', emailVerified: true, name: 'Juan Pérez' });
  }
}
