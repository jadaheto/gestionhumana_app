import { UnauthorizedError } from '../../../../../shared/domain/domain-error';
import { FakePasswordHasher } from '../../../../../shared/testing/fakes';
import { INACTIVE_USER_MESSAGE, INVALID_CREDENTIALS_MESSAGE, LoginUseCase } from '../login.use-case';
import {
  buildUser,
  InMemoryAuthUserRepository,
  InMemoryLoginHistoryRepository,
  StubContractChecker,
  StubTokenIssuer,
} from './in-memory-auth.repositories';

describe('LoginUseCase', () => {
  let users: InMemoryAuthUserRepository;
  let history: InMemoryLoginHistoryRepository;
  let contracts: StubContractChecker;
  let useCase: LoginUseCase;

  const input = { identifier: 'jperez', password: 'secreto123', device: 'Chrome', ipAddress: '127.0.0.1' };

  beforeEach(() => {
    users = new InMemoryAuthUserRepository();
    history = new InMemoryLoginHistoryRepository();
    contracts = new StubContractChecker(new Set([2]));
    useCase = new LoginUseCase(users, new FakePasswordHasher(), contracts, history, new StubTokenIssuer());
  });

  it('autentica a un funcionario con contrato activo y registra el acceso', async () => {
    users.users.push(buildUser());

    const result = await useCase.execute(input);

    expect(result.accessToken).toBe('jwt-for-2');
    expect(result.user).toMatchObject({ id: 2, username: 'jperez', role: 'funcionario' });
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({ userId: 2, device: 'Chrome', ipAddress: '127.0.0.1' });
  });

  it('acepta el correo electrónico como identificador', async () => {
    users.users.push(buildUser());
    const result = await useCase.execute({ ...input, identifier: 'jperez@comfasucre.com.co' });
    expect(result.user.id).toBe(2);
  });

  it('rechaza credenciales incorrectas sin revelar si el usuario existe', async () => {
    users.users.push(buildUser());
    await expect(useCase.execute({ ...input, password: 'otra' })).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    await expect(useCase.execute({ ...input, identifier: 'nadie' })).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    expect(history.entries).toHaveLength(0);
  });

  it('bloquea a un funcionario sin contrato activo y lo marca como inactivo', async () => {
    users.users.push(buildUser());
    contracts = new StubContractChecker(new Set());
    useCase = new LoginUseCase(users, new FakePasswordHasher(), contracts, history, new StubTokenIssuer());

    await expect(useCase.execute(input)).rejects.toThrow(new UnauthorizedError(INACTIVE_USER_MESSAGE));
    expect(users.estadoUpdates).toEqual([{ userId: 2, estado: 'inactivo' }]);
  });

  it('reactiva a un funcionario inactivo cuyo contrato volvió a estar vigente', async () => {
    users.users.push(buildUser({ estadoColaborador: 'inactivo' }));
    await useCase.execute(input);
    expect(users.estadoUpdates).toEqual([{ userId: 2, estado: 'activo' }]);
  });

  it('nunca deja entrar a un colaborador retirado', async () => {
    users.users.push(buildUser({ estadoColaborador: 'retirado' }));
    await expect(useCase.execute(input)).rejects.toThrow(INACTIVE_USER_MESSAGE);
    expect(users.estadoUpdates).toHaveLength(0);
  });

  it('permite siempre el acceso a administradores aunque no tengan contrato', async () => {
    users.users.push(buildUser({ id: 1, username: 'admin', email: 'admin@x.co', role: 'admin' }));
    contracts = new StubContractChecker(new Set());
    useCase = new LoginUseCase(users, new FakePasswordHasher(), contracts, history, new StubTokenIssuer());

    const result = await useCase.execute({ ...input, identifier: 'admin' });
    expect(result.user.role).toBe('admin');
  });
});
