import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotFoundError } from '../../../../../shared/domain/domain-error';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  CountNoLeidasUseCase,
  EliminarNotificacionUseCase,
  ListNotificacionesUseCase,
  MarcarLeidaUseCase,
  MarcarTodasLeidasUseCase,
} from '../../../application/use-cases/notificaciones.use-cases';
import { NotificacionesController } from '../notificaciones.controller';

function providers() {
  const mocks = {
    listar: { execute: jest.fn().mockResolvedValue({ noLeidas: 2, items: [{ id: 1, titulo: 'Hola' }] }) },
    contar: { execute: jest.fn().mockResolvedValue({ noLeidas: 2 }) },
    leida: { execute: jest.fn().mockResolvedValue(undefined) },
    todas: { execute: jest.fn().mockResolvedValue({ marcadas: 2 }) },
    eliminar: { execute: jest.fn().mockResolvedValue(undefined) },
  };
  return {
    mocks,
    list: [
      { provide: ListNotificacionesUseCase, useValue: mocks.listar },
      { provide: CountNoLeidasUseCase, useValue: mocks.contar },
      { provide: MarcarLeidaUseCase, useValue: mocks.leida },
      { provide: MarcarTodasLeidasUseCase, useValue: mocks.todas },
      { provide: EliminarNotificacionUseCase, useValue: mocks.eliminar },
    ],
  };
}

describe('NotificacionesController (HTTP)', () => {
  let app: INestApplication;
  let p: ReturnType<typeof providers>;
  beforeAll(async () => {
    p = providers();
    app = await createTestApp({ controllers: [NotificacionesController], providers: p.list, actor: funcionarioActor });
  });
  afterAll(() => app.close());

  it('GET /notificaciones devuelve la lista y el contador para el actor', async () => {
    const res = await request(app.getHttpServer()).get('/notificaciones?limit=5&soloNoLeidas=true').expect(200);
    expect(res.body).toEqual({ noLeidas: 2, items: [{ id: 1, titulo: 'Hola' }] });
    expect(p.mocks.listar.execute).toHaveBeenCalledWith({ actor: funcionarioActor, limit: 5, soloNoLeidas: true });
  });

  it('GET /notificaciones rechaza límites fuera de rango', async () => {
    await request(app.getHttpServer()).get('/notificaciones?limit=500').expect(400);
  });

  it('GET /notificaciones/no-leidas devuelve el contador', async () => {
    await request(app.getHttpServer()).get('/notificaciones/no-leidas').expect(200, { noLeidas: 2 });
    expect(p.mocks.contar.execute).toHaveBeenCalledWith(funcionarioActor);
  });

  it('PATCH /notificaciones/marcar-todas responde con las marcadas', async () => {
    await request(app.getHttpServer()).patch('/notificaciones/marcar-todas').expect(200, { marcadas: 2 });
    expect(p.mocks.todas.execute).toHaveBeenCalledWith(funcionarioActor);
  });

  it('PATCH /notificaciones/:id/leida responde 204 y 404 si no es propia', async () => {
    await request(app.getHttpServer()).patch('/notificaciones/9/leida').expect(204);
    expect(p.mocks.leida.execute).toHaveBeenCalledWith({ actor: funcionarioActor, id: 9 });
    p.mocks.leida.execute.mockRejectedValueOnce(new NotFoundError('Notificación', 9));
    const res = await request(app.getHttpServer()).patch('/notificaciones/9/leida').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('DELETE /notificaciones/:id responde 204', async () => {
    await request(app.getHttpServer()).delete('/notificaciones/3').expect(204);
    expect(p.mocks.eliminar.execute).toHaveBeenCalledWith({ actor: funcionarioActor, id: 3 });
  });

  it('rechaza ids no numéricos', async () => {
    await request(app.getHttpServer()).patch('/notificaciones/abc/leida').expect(400);
  });
});
