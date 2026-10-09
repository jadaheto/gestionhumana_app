import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapE2E, loginAsAdmin } from './setup-e2e';

describe('Organización (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const created: { sede?: number; area?: number; cargo?: number } = {};

  beforeAll(async () => {
    ({ app } = await bootstrapE2E());
    token = await loginAsAdmin(app);
  });
  afterAll(async () => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    if (created.cargo) await auth(request(app.getHttpServer()).delete(`/api/v1/organizacion/cargos/${created.cargo}`));
    if (created.area) await auth(request(app.getHttpServer()).delete(`/api/v1/organizacion/areas/${created.area}`));
    if (created.sede) await auth(request(app.getHttpServer()).delete(`/api/v1/organizacion/sedes/${created.sede}`));
    await app.close();
  });

  it('crea sede → área → cargo encadenados y los lista con nombres relacionados', async () => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    const sede = await auth(request(app.getHttpServer()).post('/api/v1/organizacion/sedes'))
      .send({ nombre: 'E2E Sede', ciudad: 'Sincelejo' })
      .expect(201);
    created.sede = sede.body.id;

    const area = await auth(request(app.getHttpServer()).post('/api/v1/organizacion/areas'))
      .send({ nombre: 'E2E Área', sedeId: created.sede })
      .expect(201);
    created.area = area.body.id;

    const cargo = await auth(request(app.getHttpServer()).post('/api/v1/organizacion/cargos'))
      .send({ nombre: 'E2E Cargo', areaId: created.area, nivelJerarquico: 3 })
      .expect(201);
    created.cargo = cargo.body.id;
    expect(cargo.body.nivelNombre).toBe('Coordinador');

    const areas = await auth(request(app.getHttpServer()).get('/api/v1/organizacion/areas')).expect(200);
    expect(areas.body.find((a: { id: number }) => a.id === created.area).sedeNombre).toBe('E2E Sede');

    const cargos = await auth(request(app.getHttpServer()).get('/api/v1/organizacion/cargos')).expect(200);
    expect(cargos.body.find((c: { id: number }) => c.id === created.cargo).areaNombre).toBe('E2E Área');
  });

  it('valida referencias inexistentes (404) y cuerpos inválidos (400)', async () => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    await auth(request(app.getHttpServer()).post('/api/v1/organizacion/areas'))
      .send({ nombre: 'X', sedeId: 999999 })
      .expect(404);
    await auth(request(app.getHttpServer()).post('/api/v1/organizacion/cargos'))
      .send({ nombre: 'X', nivelJerarquico: 9 })
      .expect(400);
  });
});
