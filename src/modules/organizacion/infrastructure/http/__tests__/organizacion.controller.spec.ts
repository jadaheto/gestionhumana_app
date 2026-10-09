import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { DeleteAreaUseCase, ListAreasUseCase, SaveAreaUseCase } from '../../../application/use-cases/areas.use-cases';
import {
  DeleteCargoUseCase,
  ListCargosUseCase,
  SaveCargoUseCase,
} from '../../../application/use-cases/cargos.use-cases';
import { DeleteSedeUseCase, ListSedesUseCase, SaveSedeUseCase } from '../../../application/use-cases/sedes.use-cases';
import { OrganizacionController } from '../organizacion.controller';

function providers() {
  const mock = () => ({ execute: jest.fn().mockResolvedValue([]) });
  const saveSede = { execute: jest.fn().mockResolvedValue({ id: 1, nombre: 'Principal' }) };
  return {
    saveSede,
    list: [
      { provide: ListSedesUseCase, useValue: mock() },
      { provide: SaveSedeUseCase, useValue: saveSede },
      { provide: DeleteSedeUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: ListAreasUseCase, useValue: mock() },
      { provide: SaveAreaUseCase, useValue: mock() },
      { provide: DeleteAreaUseCase, useValue: mock() },
      { provide: ListCargosUseCase, useValue: mock() },
      { provide: SaveCargoUseCase, useValue: mock() },
      { provide: DeleteCargoUseCase, useValue: mock() },
    ],
  };
}

describe('OrganizacionController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [OrganizacionController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /organizacion/sedes lista', async () => {
      await request(app.getHttpServer()).get('/organizacion/sedes').expect(200, []);
    });

    it('POST /organizacion/sedes crea y normaliza opcionales a null', async () => {
      await request(app.getHttpServer()).post('/organizacion/sedes').send({ nombre: 'Principal' }).expect(201);
      expect(p.saveSede.execute).toHaveBeenCalledWith({
        nombre: 'Principal',
        direccion: null,
        ciudad: null,
        telefono: null,
        estado: undefined,
      });
    });

    it('POST /organizacion/sedes rechaza cuerpo inválido', async () => {
      await request(app.getHttpServer()).post('/organizacion/sedes').send({ nombre: '', estado: 'raro' }).expect(400);
    });

    it('DELETE /organizacion/sedes/:id responde 204', async () => {
      await request(app.getHttpServer()).delete('/organizacion/sedes/3').expect(204);
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({
        controllers: [OrganizacionController],
        providers: providers().list,
        actor: funcionarioActor,
      });
    });
    afterAll(() => app.close());

    it('puede leer catálogos', async () => {
      await request(app.getHttpServer()).get('/organizacion/cargos').expect(200);
    });

    it('no puede escribir (403)', async () => {
      const res = await request(app.getHttpServer()).post('/organizacion/sedes').send({ nombre: 'X' }).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
