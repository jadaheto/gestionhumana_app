import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { UnauthorizedError } from '../../../../../shared/domain/domain-error';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { GoogleIdentityProvider } from '../../../application/google-identity.port';
import { GoogleLoginUseCase } from '../../../application/use-cases/google-login.use-case';
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
  const googleLogin = { execute: jest.fn() };
  const google = {
    isEnabled: jest.fn().mockReturnValue(true),
    authorizationUrl: jest.fn().mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?x=1'),
    readState: jest.fn().mockResolvedValue({ returnUrl: '/nomina' }),
    profileFromCode: jest
      .fn()
      .mockResolvedValue({ email: 'jperez@comfasucre.com.co', emailVerified: true, name: null }),
  };
  const config = { get: jest.fn().mockReturnValue('http://front') };

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
        { provide: GoogleLoginUseCase, useValue: googleLogin },
        { provide: GoogleIdentityProvider, useValue: google },
        { provide: ConfigService, useValue: config },
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

  it('GET /auth/google/estado informa si el ingreso con Google está habilitado', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google/estado').expect(200);
    expect(res.body).toEqual({ habilitado: true });
  });

  it('GET /auth/google redirige a Google', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google?returnUrl=/nomina').expect(302);
    expect(res.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(google.authorizationUrl).toHaveBeenCalledWith('/nomina');
  });

  it('GET /auth/google/callback entrega el token al frontend', async () => {
    googleLogin.execute.mockResolvedValue({ accessToken: 'jwt', user: { id: 2 } });
    const res = await request(app.getHttpServer()).get('/auth/google/callback?code=c&state=s').expect(302);
    expect(res.headers.location).toBe('http://front/auth/google?token=jwt&returnUrl=%2Fnomina');
  });

  it('GET /auth/google/callback devuelve los errores de dominio al login', async () => {
    googleLogin.execute.mockRejectedValue(new UnauthorizedError('Sin acceso'));
    const res = await request(app.getHttpServer()).get('/auth/google/callback?code=c&state=s').expect(302);
    expect(res.headers.location).toBe('http://front/auth/login?error=Sin%20acceso');
  });

  it('GET /auth/google/callback informa la cancelación del usuario', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google/callback?error=access_denied').expect(302);
    expect(res.headers.location).toContain('/auth/login?error=Cancelaste');
    expect(googleLogin.execute).not.toHaveBeenCalled();
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
