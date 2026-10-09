import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  CancelarImportacionUseCase,
  CerrarLotesAtascadosUseCase,
  ConfirmarImportacionUseCase,
  GetLoteUseCase,
  HistorialImportacionesUseCase,
  ObtenerPreviewUseCase,
  PrevisualizarImportacionUseCase,
  ProcesarLoteUseCase,
} from '../../../application/use-cases/importacion-nomina.use-cases';
import { NominaImportacionController } from '../nomina-importacion.controller';

function providers() {
  const mock = (value: unknown = []) => ({ execute: jest.fn().mockResolvedValue(value) });
  const p = {
    previsualizar: mock({ token: 'a'.repeat(32), nuevos: 1 }),
    obtener: mock({ token: 'a'.repeat(32) }),
    confirmar: mock({ loteId: 3, total: 2 }),
    cancelar: mock(undefined),
    procesar: mock({ loteId: 3, processed: 2, total: 2, done: true, estado: 'completado', counts: {} }),
    getLote: mock({ id: 3 }),
    historial: mock([{ id: 3 }]),
    cerrar: mock({ cerrados: 0 }),
  };
  return {
    p,
    list: [
      { provide: PrevisualizarImportacionUseCase, useValue: p.previsualizar },
      { provide: ObtenerPreviewUseCase, useValue: p.obtener },
      { provide: ConfirmarImportacionUseCase, useValue: p.confirmar },
      { provide: CancelarImportacionUseCase, useValue: p.cancelar },
      { provide: ProcesarLoteUseCase, useValue: p.procesar },
      { provide: GetLoteUseCase, useValue: p.getLote },
      { provide: HistorialImportacionesUseCase, useValue: p.historial },
      { provide: CerrarLotesAtascadosUseCase, useValue: p.cerrar },
    ],
  };
}

const BASE = '/admin/nomina/importaciones';

describe('NominaImportacionController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>['p'];
    beforeAll(async () => {
      const pr = providers();
      p = pr.p;
      app = await createTestApp({ controllers: [NominaImportacionController], providers: pr.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('POST preview recibe el PDF (multipart) y la fuente', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/preview`)
        .field('fuente', 'COLEGIO')
        .attach('archivo', Buffer.from('%PDF-1.4 x'), 'nomina.pdf')
        .expect(200);
      expect(res.body.token).toHaveLength(32);
      const call = p.previsualizar.execute.mock.calls[0][0];
      expect(call).toMatchObject({
        actor: adminActor,
        nombreOriginal: 'nomina.pdf',
        mimeType: 'application/pdf',
        fuente: 'COLEGIO',
      });
      expect(Buffer.isBuffer(call.archivo)).toBe(true);
    });

    it('POST preview sin archivo responde 400', async () => {
      const res = await request(app.getHttpServer()).post(`${BASE}/preview`).field('fuente', 'auto').expect(400);
      expect(res.body.message).toContain('archivo PDF');
    });

    it('GET preview/:token, POST :token/confirmar y DELETE :token', async () => {
      const token = 'b'.repeat(32);
      await request(app.getHttpServer()).get(`${BASE}/preview/${token}`).expect(200);
      expect(p.obtener.execute).toHaveBeenCalledWith(token);
      await request(app.getHttpServer()).post(`${BASE}/${token}/confirmar`).expect(200, { loteId: 3, total: 2 });
      expect(p.confirmar.execute).toHaveBeenCalledWith({ actor: adminActor, token });
      await request(app.getHttpServer()).delete(`${BASE}/${token}`).expect(204);
      expect(p.cancelar.execute).toHaveBeenCalledWith(token);
    });

    it('POST lotes/:id/procesar acepta offset/size opcionales y valida rangos', async () => {
      await request(app.getHttpServer()).post(`${BASE}/lotes/3/procesar`).send({}).expect(200);
      expect(p.procesar.execute).toHaveBeenLastCalledWith({ loteId: 3, offset: null, size: null });
      await request(app.getHttpServer()).post(`${BASE}/lotes/3/procesar`).send({ offset: 5, size: 10 }).expect(200);
      expect(p.procesar.execute).toHaveBeenLastCalledWith({ loteId: 3, offset: 5, size: 10 });
      await request(app.getHttpServer()).post(`${BASE}/lotes/3/procesar`).send({ size: 500 }).expect(400);
    });

    it('GET historial, GET lotes/:id y POST cerrar-atascados', async () => {
      await request(app.getHttpServer())
        .get(BASE)
        .expect(200, [{ id: 3 }]);
      await request(app.getHttpServer()).get(`${BASE}/lotes/3`).expect(200, { id: 3 });
      await request(app.getHttpServer()).post(`${BASE}/cerrar-atascados`).expect(200, { cerrados: 0 });
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({
        controllers: [NominaImportacionController],
        providers: providers().list,
        actor: funcionarioActor,
      });
    });
    afterAll(() => app.close());

    it('todo el controlador responde 403', async () => {
      await request(app.getHttpServer()).get(BASE).expect(403);
      await request(app.getHttpServer())
        .post(`${BASE}/preview`)
        .attach('archivo', Buffer.from('x'), 'n.pdf')
        .expect(403);
      await request(app.getHttpServer()).post(`${BASE}/lotes/1/procesar`).send({}).expect(403);
    });
  });
});
