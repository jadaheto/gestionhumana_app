import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  BuscarDirectorioUseCase,
  GetJerarquiaUseCase,
  ImportarCargosUseCase,
} from '../../../application/use-cases/organigrama.use-cases';
import { OrganigramaController } from '../organigrama.controller';

function providers() {
  const directorio = { execute: jest.fn().mockResolvedValue([]) };
  const importar = {
    execute: jest.fn().mockResolvedValue({
      areasCreadas: 1,
      cargosCreados: 2,
      salariosGuardados: 0,
      filasOmitidas: 0,
      filasProcesadas: 2,
      message: 'ok',
    }),
  };
  return {
    directorio,
    importar,
    list: [
      {
        provide: GetJerarquiaUseCase,
        useValue: { execute: jest.fn().mockResolvedValue({ configurado: false, totalCargos: 0, raiz: null }) },
      },
      { provide: BuscarDirectorioUseCase, useValue: directorio },
      { provide: ImportarCargosUseCase, useValue: importar },
    ],
  };
}

describe('OrganigramaController (HTTP)', () => {
  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [OrganigramaController], providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('GET /organigrama/jerarquia devuelve el árbol', async () => {
      const res = await request(app.getHttpServer()).get('/organigrama/jerarquia').expect(200);
      expect(res.body).toEqual({ configurado: false, totalCargos: 0, raiz: null });
    });

    it('GET /organigrama/directorio pasa los filtros convertidos', async () => {
      await request(app.getHttpServer()).get('/organigrama/directorio?q=ana&areaId=3&sedeId=2').expect(200, []);
      expect(p.directorio.execute).toHaveBeenCalledWith({ q: 'ana', areaId: 3, sedeId: 2 });
    });

    it('GET /organigrama/directorio rechaza filtros inválidos', async () => {
      await request(app.getHttpServer()).get('/organigrama/directorio?areaId=abc').expect(400);
    });

    it('POST /organigrama/importar-cargos está prohibido (403)', async () => {
      await request(app.getHttpServer()).post('/organigrama/importar-cargos').send({ dataset: 'A\tB' }).expect(403);
    });
  });

  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [OrganigramaController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('POST /organigrama/importar-cargos devuelve contadores', async () => {
      const res = await request(app.getHttpServer())
        .post('/organigrama/importar-cargos')
        .send({ dataset: 'CARGO\tAREA\nA\tB' })
        .expect(200);
      expect(res.body.cargosCreados).toBe(2);
      expect(p.importar.execute).toHaveBeenCalledWith({ dataset: 'CARGO\tAREA\nA\tB' });
    });

    it('POST /organigrama/importar-cargos exige dataset', async () => {
      await request(app.getHttpServer()).post('/organigrama/importar-cargos').send({}).expect(400);
    });
  });
});
