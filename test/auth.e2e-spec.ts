import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapE2E, loginAsAdmin } from './setup-e2e';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await bootstrapE2E());
  });
  afterAll(async () => {
    await app.close();
  });

  it('autentica al administrador sembrado y devuelve un JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'password' })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ username: 'admin', role: 'admin' });

    const rows = await dataSource.query(`SELECT COUNT(*)::int AS n FROM login_history WHERE user_id = $1`, [
      res.body.user.id,
    ]);
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it('rechaza credenciales inválidas con 401 y cuerpo uniforme', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin', password: 'incorrecta' })
      .expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('protege los endpoints sin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me devuelve el usuario del token', async () => {
    const token = await loginAsAdmin(app);
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.username).toBe('admin');
  });

  it('guarda y lee preferencias de interfaz', async () => {
    const token = await loginAsAdmin(app);
    await request(app.getHttpServer())
      .put('/api/v1/auth/ui-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: { theme: 'dark' } })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/ui-preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.theme).toBe('dark');
    await request(app.getHttpServer())
      .put('/api/v1/auth/ui-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: { theme: 'light' } })
      .expect(200);
  });
});
