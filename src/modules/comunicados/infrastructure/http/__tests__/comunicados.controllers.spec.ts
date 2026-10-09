import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  ActualizarComunicadoUseCase,
  CrearComunicadoUseCase,
  EliminarComunicadoUseCase,
  FeedComunicadosUseCase,
  GetComunicadoUseCase,
  ListComunicadosAdminUseCase,
  PublicarComunicadoUseCase,
  ReenviarCorreoComunicadoUseCase,
} from '../../../application/use-cases/comunicados.use-cases';
import { FeedConexionesUseCase } from '../../../application/use-cases/conexiones.use-cases';
import { AdminComunicadosController } from '../admin-comunicados.controller';
import { ComunicadosController } from '../comunicados.controller';
import { ConexionesController } from '../conexiones.controller';

function providers() {
  const mock = (value: unknown = []) => ({ execute: jest.fn().mockResolvedValue(value) });
  const crear = mock({ comunicado: { id: 1 }, correo: null, mensaje: 'ok' });
  const actualizar = mock({ id: 1 });
  const feed = mock({ items: [], total: 0, page: 1, size: 9 });
  const detalle = mock({ id: 1, titulo: 'T' });
  const publicar = mock({ comunicado: { id: 1 }, correo: { enviado: true, mensaje: 'OK' }, mensaje: 'ok' });
  return {
    crear,
    actualizar,
    feed,
    detalle,
    publicar,
    list: [
      { provide: ListComunicadosAdminUseCase, useValue: mock([]) },
      { provide: GetComunicadoUseCase, useValue: detalle },
      { provide: FeedComunicadosUseCase, useValue: feed },
      { provide: CrearComunicadoUseCase, useValue: crear },
      { provide: ActualizarComunicadoUseCase, useValue: actualizar },
      { provide: PublicarComunicadoUseCase, useValue: publicar },
      { provide: ReenviarCorreoComunicadoUseCase, useValue: mock({}) },
      { provide: EliminarComunicadoUseCase, useValue: mock(undefined) },
      { provide: FeedConexionesUseCase, useValue: mock({ fecha: '2026-10-08', cumpleaneros: [], aniversarios: [] }) },
    ],
  };
}

const controllers = [ComunicadosController, AdminComunicadosController, ConexionesController];

describe('Controladores de Comunicados (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers, providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /admin/comunicados lista', async () => {
      await request(app.getHttpServer()).get('/admin/comunicados').expect(200, []);
    });

    it('POST /admin/comunicados acepta multipart con archivos y URLs', async () => {
      await request(app.getHttpServer())
        .post('/admin/comunicados')
        .field('titulo', 'Hola')
        .field('contenido', 'Cuerpo')
        .field('estado', 'publicado')
        .field('videoUrls', 'https://youtu.be/1')
        .attach('archivos', Buffer.from('png'), 'foto.png')
        .attach('archivos', Buffer.from('pdf'), 'doc.pdf')
        .expect(201);
      const input = p.crear.execute.mock.calls[0][0];
      expect(input).toMatchObject({
        titulo: 'Hola',
        contenido: 'Cuerpo',
        estado: 'publicado',
        videoUrls: 'https://youtu.be/1',
        resumen: null,
      });
      expect(input.actor.id).toBe(adminActor.id);
      expect(input.archivos.map((a: { originalName: string }) => a.originalName)).toEqual(['foto.png', 'doc.pdf']);
    });

    it('POST /admin/comunicados rechaza cuerpo sin título/contenido o estado inválido', async () => {
      await request(app.getHttpServer())
        .post('/admin/comunicados')
        .field('titulo', '')
        .field('contenido', 'x')
        .expect(400);
      await request(app.getHttpServer())
        .post('/admin/comunicados')
        .field('titulo', 'x')
        .field('contenido', 'x')
        .field('estado', 'raro')
        .expect(400);
    });

    it('PUT /admin/comunicados/:id parsea los ids de medios a eliminar', async () => {
      await request(app.getHttpServer())
        .put('/admin/comunicados/4')
        .field('titulo', 'Hola')
        .field('contenido', 'Cuerpo')
        .field('eliminarMedios', '3, 7,x')
        .expect(200);
      expect(p.actualizar.execute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 4, eliminarMedios: [3, 7], archivos: [] }),
      );
    });

    it('POST /admin/comunicados/:id/publicar responde 200 con el resultado del correo', async () => {
      const res = await request(app.getHttpServer()).post('/admin/comunicados/4/publicar').expect(200);
      expect(res.body.correo.enviado).toBe(true);
      expect(p.publicar.execute).toHaveBeenCalledWith(4);
    });

    it('POST /admin/comunicados/:id/reenviar-correo y DELETE', async () => {
      await request(app.getHttpServer()).post('/admin/comunicados/4/reenviar-correo').expect(200);
      await request(app.getHttpServer()).delete('/admin/comunicados/4').expect(204);
    });

    it('GET /comunicados valida la paginación', async () => {
      await request(app.getHttpServer()).get('/comunicados?page=2&size=5').expect(200);
      expect(p.feed.execute).toHaveBeenCalledWith({ page: 2, size: 5 });
      await request(app.getHttpServer()).get('/comunicados?size=99').expect(400);
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers, providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('puede leer el feed, el detalle y conexiones', async () => {
      await request(app.getHttpServer()).get('/comunicados').expect(200);
      await request(app.getHttpServer()).get('/comunicados/1').expect(200);
      expect(p.detalle.execute).toHaveBeenCalledWith({ id: 1, actor: funcionarioActor });
      const res = await request(app.getHttpServer()).get('/conexiones/feed').expect(200);
      expect(res.body.fecha).toBe('2026-10-08');
    });

    it('no puede administrar (403)', async () => {
      await request(app.getHttpServer()).get('/admin/comunicados').expect(403);
      await request(app.getHttpServer()).post('/admin/comunicados/1/publicar').expect(403);
      await request(app.getHttpServer()).delete('/admin/comunicados/1').expect(403);
    });
  });
});
