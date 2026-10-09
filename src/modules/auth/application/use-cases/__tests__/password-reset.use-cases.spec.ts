import { ConfigService } from '@nestjs/config';
import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { FakeClock, FakeMailer, FakePasswordHasher, FakeTokenGenerator } from '../../../../../shared/testing/fakes';
import { RequestPasswordResetUseCase } from '../request-password-reset.use-case';
import { ResetPasswordUseCase } from '../reset-password.use-case';
import { ValidateResetTokenUseCase } from '../validate-reset-token.use-case';
import { buildUser, InMemoryAuthUserRepository, InMemoryPasswordResetRepository } from './in-memory-auth.repositories';

const configStub = { get: () => 'http://front.local' } as unknown as ConfigService;

describe('Restablecimiento de contraseña', () => {
  let users: InMemoryAuthUserRepository;
  let resets: InMemoryPasswordResetRepository;
  let clock: FakeClock;
  let mailer: FakeMailer;
  let request: RequestPasswordResetUseCase;
  let reset: ResetPasswordUseCase;
  let validate: ValidateResetTokenUseCase;

  beforeEach(() => {
    users = new InMemoryAuthUserRepository();
    users.users.push(buildUser());
    resets = new InMemoryPasswordResetRepository();
    clock = new FakeClock();
    mailer = new FakeMailer();
    request = new RequestPasswordResetUseCase(
      users,
      resets,
      new FakeTokenGenerator('abc123'),
      clock,
      mailer,
      configStub as never,
    );
    reset = new ResetPasswordUseCase(users, resets, new FakePasswordHasher(), clock);
    validate = new ValidateResetTokenUseCase(resets, clock);
  });

  it('crea un token válido por una hora y envía el correo con el enlace', async () => {
    await request.execute({ email: 'JPEREZ@comfasucre.com.co' });

    expect(resets.resets).toHaveLength(1);
    expect(resets.resets[0].props.expiresAt.getTime() - clock.now().getTime()).toBe(60 * 60 * 1000);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('jperez@comfasucre.com.co');
    expect(mailer.sent[0].html).toContain('http://front.local/auth/reset-password/abc123');
  });

  it('falla si el correo no existe', async () => {
    await expect(request.execute({ email: 'nadie@x.co' })).rejects.toBeInstanceOf(NotFoundError);
    expect(mailer.sent).toHaveLength(0);
  });

  it('invalida los tokens anteriores al solicitar uno nuevo', async () => {
    await request.execute({ email: 'jperez@comfasucre.com.co' });
    await request.execute({ email: 'jperez@comfasucre.com.co' });
    expect(resets.resets.filter((r) => r.props.usedAt === null)).toHaveLength(1);
  });

  it('restablece la contraseña con un token válido y lo marca como usado', async () => {
    await request.execute({ email: 'jperez@comfasucre.com.co' });
    await reset.execute({ token: 'abc123', newPassword: 'NuevaClave1', confirmPassword: 'NuevaClave1' });

    expect(users.passwordUpdates).toEqual([{ userId: 2, hash: 'hashed:NuevaClave1' }]);
    expect((await validate.execute('abc123')).valid).toBe(false);
  });

  it('rechaza un token expirado', async () => {
    await request.execute({ email: 'jperez@comfasucre.com.co' });
    clock.advanceMinutes(61);
    expect((await validate.execute('abc123')).valid).toBe(false);
    await expect(
      reset.execute({ token: 'abc123', newPassword: 'NuevaClave1', confirmPassword: 'NuevaClave1' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza contraseñas que no coinciden o demasiado cortas', async () => {
    await request.execute({ email: 'jperez@comfasucre.com.co' });
    await expect(
      reset.execute({ token: 'abc123', newPassword: 'NuevaClave1', confirmPassword: 'Otra' }),
    ).rejects.toThrow('Las contraseñas no coinciden.');
    await expect(reset.execute({ token: 'abc123', newPassword: 'corta', confirmPassword: 'corta' })).rejects.toThrow(
      /al menos 8 caracteres/,
    );
    expect(users.passwordUpdates).toHaveLength(0);
  });
});
