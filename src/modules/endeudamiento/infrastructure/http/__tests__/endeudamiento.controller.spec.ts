import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  BuscarColaboradorUseCase,
  CrearSolicitudUseCase,
  GenerarNumeroSolicitudUseCase,
  GetSalarioReferenciaUseCase,
  GetSolicitudUseCase,
  ListSolicitudesUseCase,
} from '../../../application/use-cases/endeudamiento.use-cases';
import { EndeudamientoController } from '../endeudamiento.controller';

function providers() {
  const mocks = {
    listar: { execute: jest.fn().mockResolvedValue([]) },
    ver: { execute: jest.fn().mockResolvedValue({ id: 4 }) },
    crear: { execute: jest.fn().mockResolvedValue({ id: 9, estado: 'aprobado' }) },
    numerador: { execute: jest.fn().mockResolvedValue({ solicitudNo: 'SOL-2026-0001' }) },
    buscar: { execute: jest.fn().mockResolvedValue([{ id: 1, nombre: 'Ana' }]) },
    salario: { execute: jest.fn().mockResolvedValue({ userId: 1, salario: 100 }) },
  };
  return {
    mocks,
    list: [
      { provide: ListSolicitudesUseCase, useValue: mocks.listar },
      { provide: GetSolicitudUseCase, useValue: mocks.ver },
      { provide: CrearSolicitudUseCase, useValue: mocks.crear },
      { provide: GenerarNumeroSolicitudUseCase, useValue: mocks.numerador },
      { provide: BuscarColaboradorUseCase, useValue: mocks.buscar },
      { provide: GetSalarioReferenciaUseCase, useValue: mocks.salario },
    ],
  };
}

describe('EndeudamientoController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [EndeudamientoController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /endeudamiento lista', async () => {
      await request(app.getHttpServer()).get('/endeudamiento').expect(200, []);
    });

    it('GET /endeudamiento/siguiente-numero y /colaboradores no chocan con /:id', async () => {
      await request(app.getHttpServer())
        .get('/endeudamiento/siguiente-numero')
        .expect(200, { solicitudNo: 'SOL-2026-0001' });
      await request(app.getHttpServer())
        .get('/endeudamiento/colaboradores?q=an')
        .expect(200, [{ id: 1, nombre: 'Ana' }]);
      expect(p.mocks.buscar.execute).toHaveBeenCalledWith({ q: 'an' });
      await request(app.getHttpServer())
        .get('/endeudamiento/colaboradores/1/salario-referencia')
        .expect(200, { userId: 1, salario: 100 });
      await request(app.getHttpServer()).get('/endeudamiento/4').expect(200, { id: 4 });
    });

    it('POST /endeudamiento valida el cuerpo y pasa conceptos normalizados y el actor', async () => {
      await request(app.getHttpServer())
        .post('/endeudamiento')
        .send({
          userId: 3,
          fecha: '2026-10-08',
          salarioMensual: 2000000,
          conceptos: [{ concepto: 'SALUD', deducido: 80000 }],
          plazoMeses: 24,
        })
        .expect(201);
      const input = p.mocks.crear.execute.mock.calls[0][0];
      expect(input.actor).toEqual(adminActor);
      expect(input.conceptos).toEqual([{ concepto: 'SALUD', devengado: 0, deducido: 80000 }]);
      expect(input.plazoMeses).toBe(24);

      await request(app.getHttpServer())
        .post('/endeudamiento')
        .send({ userId: 3, fecha: '08/10/2026', salarioMensual: 1, conceptos: [] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/endeudamiento')
        .send({ userId: 3, fecha: '2026-10-08', salarioMensual: -1, conceptos: [] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/endeudamiento')
        .send({ userId: 3, fecha: '2026-10-08', salarioMensual: 1 })
        .expect(400);
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({
        controllers: [EndeudamientoController],
        providers: providers().list,
        actor: funcionarioActor,
      });
    });
    afterAll(() => app.close());

    it('todo el recurso responde 403', async () => {
      await request(app.getHttpServer()).get('/endeudamiento').expect(403);
      await request(app.getHttpServer()).get('/endeudamiento/colaboradores').expect(403);
      await request(app.getHttpServer()).post('/endeudamiento').send({}).expect(403);
    });
  });
});
