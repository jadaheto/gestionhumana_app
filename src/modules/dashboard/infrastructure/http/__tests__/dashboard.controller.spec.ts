import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp } from '../../../../../shared/testing';
import { GetDashboardUseCase } from '../../../application/use-cases/get-dashboard.use-case';
import { DashboardController } from '../dashboard.controller';

describe('DashboardController (HTTP)', () => {
  let app: INestApplication;
  const useCase = { execute: jest.fn().mockResolvedValue({ rol: 'admin', hoy: '2026-10-08' }) };

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [DashboardController],
      providers: [{ provide: GetDashboardUseCase, useValue: useCase }],
      actor: adminActor,
    });
  });
  afterAll(() => app.close());

  it('GET /dashboard devuelve el payload y pasa el actor autenticado', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard').expect(200);
    expect(res.body.rol).toBe('admin');
    expect(useCase.execute).toHaveBeenCalledWith(expect.objectContaining({ id: adminActor.id, role: 'admin' }));
  });

  it('GET /dashboard sin sesión responde 403', async () => {
    const anon = await createTestApp({
      controllers: [DashboardController],
      providers: [{ provide: GetDashboardUseCase, useValue: useCase }],
      actor: null,
    });
    await request(anon.getHttpServer()).get('/dashboard').expect(403);
    await anon.close();
  });
});
