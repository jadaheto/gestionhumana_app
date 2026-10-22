import { GoogleLoginUseCase } from '../google-login.use-case';
import { INACTIVE_USER_MESSAGE } from '../login.use-case';
import {
  buildUser,
  InMemoryAuthUserRepository,
  InMemoryLoginHistoryRepository,
  StubContractChecker,
  StubGoogleIdentityProvider,
  StubTokenIssuer,
} from './in-memory-auth.repositories';

describe('GoogleLoginUseCase', () => {
  let users: InMemoryAuthUserRepository;
  let history: InMemoryLoginHistoryRepository;
  let useCase: GoogleLoginUseCase;

  const profile = { email: 'jperez@comfasucre.com.co', emailVerified: true, name: 'Juan Pérez' };
  const input = { profile, device: 'Chrome', ipAddress: '127.0.0.1' };

  const build = (domain = 'comfasucre.com.co', active = new Set([2])) =>
    new GoogleLoginUseCase(
      users,
      new StubContractChecker(active),
      history,
      new StubTokenIssuer(),
      new StubGoogleIdentityProvider(domain),
    );

  beforeEach(() => {
    users = new InMemoryAuthUserRepository();
    history = new InMemoryLoginHistoryRepository();
    useCase = build();
  });

  it('abre la sesión de un correo registrado y registra el acceso', async () => {
    users.users.push(buildUser());
    const result = await useCase.execute(input);
    expect(result.accessToken).toBe('jwt-for-2');
    expect(result.user).toMatchObject({ id: 2, email: 'jperez@comfasucre.com.co' });
    expect(history.entries).toHaveLength(1);
  });

  it('rechaza correos no verificados por Google', async () => {
    users.users.push(buildUser());
    await expect(useCase.execute({ ...input, profile: { ...profile, emailVerified: false } })).rejects.toThrow(
      'no tiene el correo verificado',
    );
  });

  it('rechaza cuentas fuera del dominio permitido', async () => {
    users.users.push(buildUser({ email: 'jperez@gmail.com' }));
    await expect(useCase.execute({ ...input, profile: { ...profile, email: 'jperez@gmail.com' } })).rejects.toThrow(
      'Solo se permiten cuentas @comfasucre.com.co.',
    );
  });

  it('acepta cualquier dominio cuando no hay uno configurado', async () => {
    users.users.push(buildUser({ email: 'jperez@gmail.com' }));
    useCase = build('');
    const result = await useCase.execute({ ...input, profile: { ...profile, email: 'jperez@gmail.com' } });
    expect(result.user.id).toBe(2);
  });

  it('rechaza correos que no están registrados', async () => {
    await expect(useCase.execute(input)).rejects.toThrow('no tiene acceso a Gestión Humana');
    expect(history.entries).toHaveLength(0);
  });

  it('aplica la regla de contrato activo', async () => {
    users.users.push(buildUser());
    useCase = build('comfasucre.com.co', new Set());
    await expect(useCase.execute(input)).rejects.toThrow(INACTIVE_USER_MESSAGE);
  });
});
