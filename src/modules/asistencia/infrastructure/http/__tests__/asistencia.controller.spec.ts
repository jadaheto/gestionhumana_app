import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { EnviarMemorandosUseCase } from '../../../application/use-cases/enviar-memorandos.use-case';
import { GetMiHistorialUseCase } from '../../../application/use-cases/get-mi-historial.use-case';
import { GetResumenDiarioUseCase } from '../../../application/use-cases/get-resumen-diario.use-case';
import { ImportarMarcacionesUseCase } from '../../../application/use-cases/importar-marcaciones.use-case';
import { ListSedesAsistenciaUseCase } from '../../../application/use-cases/list-sedes.use-case';
import { GetPoliticaUseCase, SavePoliticaUseCase } from '../../../application/use-cases/politica.use-cases';
import { AsistenciaController } from '../asistencia.controller';

function providers() {
  const mocks = {
    sedes: { execute: jest.fn().mockResolvedValue([{ id: 1, nombre: 'Principal' }]) },
    resumen: { execute: jest.fn().mockResolvedValue({ fecha: '2026-10-08', sedeId: 1, politica: {}, resumen: [] }) },
    importar: {
      execute: jest.fn().mockResolvedValue({ importacionId: 5, totalFilas: 2, sinColaborador: 0, mensaje: 'ok' }),
    },
    memorandos: { execute: jest.fn().mockResolvedValue({ enviados: 1, fallidos: 0, mensaje: 'ok' }) },
    getPolitica: { execute: jest.fn().mockResolvedValue({ sedeId: 1 }) },
    savePolitica: { execute: jest.fn().mockResolvedValue({ sedeId: 1, toleranciaMinutos: 5 }) },
    historial: { execute: jest.fn().mockResolvedValue([]) },
  };
  return {
    mocks,
    list: [
      { provide: ListSedesAsistenciaUseCase, useValue: mocks.sedes },
      { provide: GetResumenDiarioUseCase, useValue: mocks.resumen },
      { provide: ImportarMarcacionesUseCase, useValue: mocks.importar },
      { provide: EnviarMemorandosUseCase, useValue: mocks.memorandos },
      { provide: GetPoliticaUseCase, useValue: mocks.getPolitica },
      { provide: SavePoliticaUseCase, useValue: mocks.savePolitica },
      { provide: GetMiHistorialUseCase, useValue: mocks.historial },
    ],
  };
}

describe('AsistenciaController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [AsistenciaController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /asistencia/sedes lista sedes', async () => {
      await request(app.getHttpServer())
        .get('/asistencia/sedes')
        .expect(200, [{ id: 1, nombre: 'Principal' }]);
    });

    it('GET /asistencia/resumen exige sedeId y valida la fecha', async () => {
      await request(app.getHttpServer()).get('/asistencia/resumen').expect(400);
      await request(app.getHttpServer()).get('/asistencia/resumen?sedeId=1&fecha=08/10/2026').expect(400);
      await request(app.getHttpServer()).get('/asistencia/resumen?sedeId=1&fecha=2026-10-08').expect(200);
      expect(p.mocks.resumen.execute).toHaveBeenCalledWith({ sedeId: 1, fecha: '2026-10-08' });
    });

    it('POST /asistencia/importar recibe multipart y pasa el buffer al caso de uso', async () => {
      await request(app.getHttpServer())
        .post('/asistencia/importar')
        .field('sedeId', '2')
        .attach('archivo', Buffer.from('ID de Usuario,Nombre\n1,Ana'), 'reloj.csv')
        .expect(201);
      const input = p.mocks.importar.execute.mock.calls[0][0];
      expect(input.sedeId).toBe(2);
      expect(input.actor.id).toBe(adminActor.id);
      expect(input.archivo.originalName).toBe('reloj.csv');
      expect(input.archivo.buffer.toString()).toContain('Ana');
    });

    it('POST /asistencia/memorandos responde 200 con el resultado', async () => {
      await request(app.getHttpServer())
        .post('/asistencia/memorandos')
        .send({ sedeId: 1, fecha: '2026-10-08' })
        .expect(200, { enviados: 1, fallidos: 0, mensaje: 'ok' });
    });

    it('PUT /asistencia/politicas/:sedeId valida y normaliza booleanos', async () => {
      await request(app.getHttpServer())
        .put('/asistencia/politicas/3')
        .send({
          horaEntradaLimite: '08:00',
          horaSalidaTemprana: '12:00',
          toleranciaMinutos: 5,
          enviarMemorandoTardanza: 'true',
        })
        .expect(200);
      expect(p.mocks.savePolitica.execute).toHaveBeenCalledWith({
        sedeId: 3,
        horaEntradaLimite: '08:00',
        horaSalidaTemprana: '12:00',
        toleranciaMinutos: 5,
        enviarMemorandoTardanza: true,
      });
      await request(app.getHttpServer())
        .put('/asistencia/politicas/3')
        .send({ horaEntradaLimite: '8', horaSalidaTemprana: '12:00', toleranciaMinutos: -1 })
        .expect(400);
    });

    it('GET /asistencia/mi-historial usa el actor autenticado', async () => {
      await request(app.getHttpServer())
        .get('/asistencia/mi-historial?desde=2026-10-01&hasta=2026-10-31')
        .expect(200, []);
      expect(p.mocks.historial.execute).toHaveBeenCalledWith({
        actor: adminActor,
        desde: '2026-10-01',
        hasta: '2026-10-31',
      });
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({
        controllers: [AsistenciaController],
        providers: providers().list,
        actor: funcionarioActor,
      });
    });
    afterAll(() => app.close());

    it('puede consultar su historial', async () => {
      await request(app.getHttpServer()).get('/asistencia/mi-historial').expect(200);
    });

    it('no puede acceder a las operaciones de administración (403)', async () => {
      await request(app.getHttpServer()).get('/asistencia/resumen?sedeId=1').expect(403);
      await request(app.getHttpServer()).post('/asistencia/memorandos').send({ sedeId: 1 }).expect(403);
      await request(app.getHttpServer()).put('/asistencia/politicas/1').send({}).expect(403);
      await request(app.getHttpServer()).get('/asistencia/sedes').expect(403);
    });
  });
});
