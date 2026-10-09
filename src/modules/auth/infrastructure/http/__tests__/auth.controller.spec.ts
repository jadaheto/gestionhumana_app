import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UnauthorizedError } from '../../../../../shared/domain/domain-error';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { GetCurrentUserUseCase } from '../../../application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import {
  GetUiPreferencesUseCase,
  SaveUiPreferencesUseCase,
} from '../../../application/use-cases/ui-preferences.use-cases';
import { ValidateResetTokenUseCase } from '../../../application/use-cases/validate-reset-token.use-case';
import { AuthController } from '../auth.controller';

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  const login = { execute: jest.fn() };
  const getPrefs = { execute: jest.fn() };
  const savePrefs = { execute: jest.fn() };
  const me = { execute: jest.fn() };

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: login },
        { provide: RequestPasswordResetUseCase, useValue: { execute: jest.fn() } },
        { provide: ResetPasswordUseCase, useValue: { execute: jest.fn() } },
        { provide: ValidateResetTokenUseCase, useValue: { execute: jest.fn().mockResolvedValue({ valid: true }) } },
        { provide: GetUiPreferencesUseCase, useValue: getPrefs },
        { provide: SaveUiPreferencesUseCase, useValue: savePrefs },
        { provide: GetCurrentUserUseCase, useValue: me },
      ],
      actor: funcionarioActor,
    });
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('POST /auth/login devuelve token y usuario', async () => {
    login.execute.mockResolvedValue({ accessToken: 'jwt', user: { id: 2 } });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', 'JestAgent')
      .send({ identifier: 'jperez', password: 'x' })
      .expect(200);
    expect(res.body).toEqual({ accessToken: 'jwt', user: { id: 2 } });
    expect(login.execute).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'jperez', device: 'JestAgent' }));
  });

  it('POST /auth/login valida el cuerpo (400)', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ identifier: '' }).expect(400);
    expect(login.execute).not.toHaveBeenCalled();
  });

  it('traduce UnauthorizedError a 401 con cuerpo uniforme', async () => {
    login.execute.mockRejectedValue(new UnauthorizedError('Las credenciales no coinciden con nuestros registros.'));
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'a', password: 'b' })
      .expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Las credenciales no coinciden con nuestros registros.',
    });
  });

  it('GET /auth/me usa el actor autenticado', async () => {
    me.execute.mockResolvedValue({ id: 2, username: 'jperez' });
    await request(app.getHttpServer()).get('/auth/me').expect(200);
    expect(me.execute).toHaveBeenCalledWith(funcionarioActor);
  });

  it('PUT /auth/ui-preferences envía las preferencias al caso de uso', async () => {
    savePrefs.execute.mockResolvedValue({ theme: 'dark' });
    const res = await request(app.getHttpServer())
      .put('/auth/ui-preferences')
      .send({ preferences: { theme: 'dark' } })
      .expect(200);
    expect(res.body).toEqual({ theme: 'dark' });
    expect(savePrefs.execute).toHaveBeenCalledWith({ actor: funcionarioActor, preferences: { theme: 'dark' } });
  });
});
