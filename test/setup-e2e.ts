import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

/**
 * Arranca la aplicación completa contra la base de datos de `.env`
 * (usa `.env.test` si existe). Requiere PostgreSQL con las migraciones aplicadas.
 */
export async function bootstrapE2E(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

export async function loginAsAdmin(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ identifier: 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'password' })
    .expect(200);
  return res.body.accessToken as string;
}
