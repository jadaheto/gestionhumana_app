import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { AsignarPuntosUseCase, ListColaboradoresUseCase } from '../../../application/use-cases/admin.use-cases';
import {
  GetMiBalanceUseCase,
  ListMisTransaccionesUseCase,
  ListRecompensasUseCase,
} from '../../../application/use-cases/balance.use-cases';
import {
  CanjearRecompensaUseCase,
  ListCanjesUseCase,
  ListMisCanjesUseCase,
  ResolverCanjeUseCase,
} from '../../../application/use-cases/canjes.use-cases';
import { PuntosController } from '../puntos.controller';

function providers() {
  const balance = {
    userId: 2,
    puntosActuales: 10,
    puntosTotalesGanados: 10,
    puntosTotalesCanjeados: 0,
    updatedAt: null,
  };
  const mocks = {
    miBalance: { execute: jest.fn().mockResolvedValue(balance) },
    historial: { execute: jest.fn().mockResolvedValue([]) },
    recompensas: { execute: jest.fn().mockResolvedValue([]) },
    canjear: { execute: jest.fn().mockResolvedValue({ id: 7, estado: 'pendiente' }) },
    misCanjes: { execute: jest.fn().mockResolvedValue([]) },
    canjes: { execute: jest.fn().mockResolvedValue([]) },
    resolver: { execute: jest.fn().mockResolvedValue({ id: 7, estado: 'aprobado' }) },
    asignar: { execute: jest.fn().mockResolvedValue(balance) },
    colaboradores: { execute: jest.fn().mockResolvedValue([]) },
  };
  return {
    mocks,
    list: [
      { provide: GetMiBalanceUseCase, useValue: mocks.miBalance },
      { provide: ListMisTransaccionesUseCase, useValue: mocks.historial },
      { provide: ListRecompensasUseCase, useValue: mocks.recompensas },
      { provide: CanjearRecompensaUseCase, useValue: mocks.canjear },
      { provide: ListMisCanjesUseCase, useValue: mocks.misCanjes },
      { provide: ListCanjesUseCase, useValue: mocks.canjes },
      { provide: ResolverCanjeUseCase, useValue: mocks.resolver },
      { provide: AsignarPuntosUseCase, useValue: mocks.asignar },
      { provide: ListColaboradoresUseCase, useValue: mocks.colaboradores },
    ],
  };
}

describe('PuntosController (HTTP)', () => {
  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [PuntosController], providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('GET /puntos/mi-balance usa el actor autenticado', async () => {
      const res = await request(app.getHttpServer()).get('/puntos/mi-balance').expect(200);
      expect(res.body.puntosActuales).toBe(10);
      expect(p.mocks.miBalance.execute).toHaveBeenCalledWith(funcionarioActor);
    });

    it('GET /puntos/historial?limit=10 pasa el límite numérico', async () => {
      await request(app.getHttpServer()).get('/puntos/historial?limit=10').expect(200, []);
      expect(p.mocks.historial.execute).toHaveBeenCalledWith({ actor: funcionarioActor, limit: 10 });
    });

    it('GET /puntos/historial rechaza límites inválidos', async () => {
      await request(app.getHttpServer()).get('/puntos/historial?limit=0').expect(400);
    });

    it('GET /puntos/recompensas y /puntos/mis-canjes responden 200', async () => {
      await request(app.getHttpServer()).get('/puntos/recompensas').expect(200, []);
      await request(app.getHttpServer()).get('/puntos/mis-canjes').expect(200, []);
    });

    it('POST /puntos/recompensas/:id/canjear responde 201 con el canje', async () => {
      const res = await request(app.getHttpServer()).post('/puntos/recompensas/3/canjear').expect(201);
      expect(res.body.estado).toBe('pendiente');
      expect(p.mocks.canjear.execute).toHaveBeenCalledWith({ actor: funcionarioActor, recompensaId: 3 });
    });

    it('no accede a los endpoints de administración (403)', async () => {
      await request(app.getHttpServer()).get('/puntos/colaboradores').expect(403);
      await request(app.getHttpServer()).get('/puntos/canjes').expect(403);
      await request(app.getHttpServer())
        .post('/puntos/asignar')
        .send({ userId: 2, cantidad: 5, concepto: 'x' })
        .expect(403);
      await request(app.getHttpServer()).post('/puntos/canjes/1/aprobar').expect(403);
      await request(app.getHttpServer()).post('/puntos/canjes/1/rechazar').expect(403);
    });
  });

  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [PuntosController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /puntos/colaboradores lista', async () => {
      await request(app.getHttpServer()).get('/puntos/colaboradores').expect(200, []);
    });

    it('POST /puntos/asignar valida el cuerpo', async () => {
      await request(app.getHttpServer())
        .post('/puntos/asignar')
        .send({ userId: 2, cantidad: 0, concepto: 'x' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/puntos/asignar')
        .send({ userId: 2, cantidad: 5, concepto: '' })
        .expect(400);
      await request(app.getHttpServer()).post('/puntos/asignar').send({ cantidad: 5, concepto: 'x' }).expect(400);
      expect(p.mocks.asignar.execute).not.toHaveBeenCalled();
    });

    it('POST /puntos/asignar responde 201 y pasa sólo los campos esperados', async () => {
      await request(app.getHttpServer())
        .post('/puntos/asignar')
        .send({ userId: '2', cantidad: '15', concepto: 'Buen trabajo', extra: 'no' })
        .expect(201);
      expect(p.mocks.asignar.execute).toHaveBeenCalledWith({ userId: 2, cantidad: 15, concepto: 'Buen trabajo' });
    });

    it('GET /puntos/canjes filtra por estado (pendiente por defecto)', async () => {
      await request(app.getHttpServer()).get('/puntos/canjes').expect(200);
      expect(p.mocks.canjes.execute).toHaveBeenLastCalledWith({ estado: 'pendiente' });
      await request(app.getHttpServer()).get('/puntos/canjes?estado=todos').expect(200);
      expect(p.mocks.canjes.execute).toHaveBeenLastCalledWith({ estado: 'todos' });
      await request(app.getHttpServer()).get('/puntos/canjes?estado=raro').expect(400);
    });

    it('POST /puntos/canjes/:id/aprobar y /rechazar invocan el caso de uso con la acción', async () => {
      await request(app.getHttpServer()).post('/puntos/canjes/7/aprobar').expect(200);
      expect(p.mocks.resolver.execute).toHaveBeenLastCalledWith({ actor: adminActor, canjeId: 7, accion: 'aprobado' });
      await request(app.getHttpServer()).post('/puntos/canjes/7/rechazar').expect(200);
      expect(p.mocks.resolver.execute).toHaveBeenLastCalledWith({ actor: adminActor, canjeId: 7, accion: 'rechazado' });
    });
  });
});
