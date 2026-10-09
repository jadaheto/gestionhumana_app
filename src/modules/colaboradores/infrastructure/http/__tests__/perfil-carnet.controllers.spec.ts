import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UnauthorizedError } from '../../../../../shared/domain/domain-error';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { GetCarnetUseCase } from '../../../application/use-cases/carnet.use-cases';
import {
  ChangePasswordUseCase,
  GetPerfilUseCase,
  UpdateExperienceUseCase,
  UpdatePerfilUseCase,
  UpdatePortafolioUseCase,
  UpdatePrivacySettingsUseCase,
  UploadPerfilImageUseCase,
} from '../../../application/use-cases/perfil.use-cases';
import { CarnetController } from '../carnet.controller';
import { PerfilController } from '../perfil.controller';

describe('PerfilController y CarnetController (HTTP)', () => {
  let app: INestApplication;
  const getPerfil = { execute: jest.fn() };
  const updatePerfil = { execute: jest.fn() };
  const upload = { execute: jest.fn() };
  const changePassword = { execute: jest.fn() };
  const privacy = { execute: jest.fn() };
  const experience = { execute: jest.fn() };
  const carnet = { execute: jest.fn() };

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [PerfilController, CarnetController],
      providers: [
        { provide: GetPerfilUseCase, useValue: getPerfil },
        { provide: UpdatePerfilUseCase, useValue: updatePerfil },
        { provide: UpdatePortafolioUseCase, useValue: { execute: jest.fn().mockResolvedValue({}) } },
        { provide: UploadPerfilImageUseCase, useValue: upload },
        { provide: ChangePasswordUseCase, useValue: changePassword },
        { provide: UpdatePrivacySettingsUseCase, useValue: privacy },
        { provide: UpdateExperienceUseCase, useValue: experience },
        { provide: GetCarnetUseCase, useValue: carnet },
      ],
      actor: funcionarioActor,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('GET /perfil devuelve el perfil del actor', async () => {
    getPerfil.execute.mockResolvedValue({ id: 2, loginHistory: [] });
    await request(app.getHttpServer()).get('/perfil').expect(200, { id: 2, loginHistory: [] });
    expect(getPerfil.execute).toHaveBeenCalledWith(funcionarioActor);
  });

  it('PUT /perfil valida y normaliza los datos', async () => {
    await request(app.getHttpServer()).put('/perfil').send({ firstName: '', email: 'x' }).expect(400);
    updatePerfil.execute.mockResolvedValue({ id: 2 });
    await request(app.getHttpServer())
      .put('/perfil')
      .send({ firstName: 'Juan', lastName: 'Pérez', email: 'j@x.com', skills: ['Excel'], city: '' })
      .expect(200);
    expect(updatePerfil.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      datos: expect.objectContaining({ firstName: 'Juan', skills: ['Excel'], city: null, joiningDate: null }),
    });
  });

  it('POST /perfil/foto y /perfil/portada suben imágenes', async () => {
    upload.execute.mockResolvedValue({ id: 2 });
    await request(app.getHttpServer()).post('/perfil/foto').attach('file', Buffer.from('a'), 'yo.jpg').expect(201);
    expect(upload.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'profile', originalName: 'yo.jpg' }));
    await request(app.getHttpServer())
      .post('/perfil/portada')
      .attach('file', Buffer.from('b'), 'fondo.png')
      .expect(201);
    expect(upload.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'cover' }));
    await request(app.getHttpServer()).post('/perfil/foto').expect(400);
  });

  it('PUT /perfil/password traduce la contraseña incorrecta a 401', async () => {
    changePassword.execute.mockRejectedValue(new UnauthorizedError('La contraseña actual es incorrecta.'));
    const res = await request(app.getHttpServer())
      .put('/perfil/password')
      .send({ oldPassword: 'a', newPassword: 'nueva1234', confirmPassword: 'nueva1234' })
      .expect(401);
    expect(res.body.message).toBe('La contraseña actual es incorrecta.');
    changePassword.execute.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .put('/perfil/password')
      .send({ oldPassword: 'a', newPassword: 'nueva1234', confirmPassword: 'nueva1234' })
      .expect(200);
    await request(app.getHttpServer())
      .put('/perfil/password')
      .send({ oldPassword: 'a', newPassword: 'corta', confirmPassword: 'corta' })
      .expect(400);
  });

  it('PUT /perfil/privacidad y /perfil/experiencia envían los datos al caso de uso', async () => {
    privacy.execute.mockResolvedValue({ email_notifications: true });
    await request(app.getHttpServer()).put('/perfil/privacidad').send({ email_notifications: true }).expect(200);
    expect(privacy.execute).toHaveBeenCalledWith({ actor: funcionarioActor, settings: { email_notifications: true } });
    experience.execute.mockResolvedValue([]);
    await request(app.getHttpServer())
      .put('/perfil/experiencia')
      .send({ experience: [{ job_title: 'Analista', year_from: '2020' }] })
      .expect(200);
    expect(experience.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      experience: [{ job_title: 'Analista', year_from: '2020' }],
    });
    await request(app.getHttpServer()).put('/perfil/experiencia').send({ experience: 'no' }).expect(400);
  });

  it('GET /carnet y /carnet/:userId', async () => {
    carnet.execute.mockResolvedValue({ userId: 2 });
    await request(app.getHttpServer()).get('/carnet').expect(200);
    expect(carnet.execute).toHaveBeenCalledWith({ actor: funcionarioActor });
    await request(app.getHttpServer()).get('/carnet/5').expect(200);
    expect(carnet.execute).toHaveBeenCalledWith({ actor: funcionarioActor, userId: 5 });
  });
});
