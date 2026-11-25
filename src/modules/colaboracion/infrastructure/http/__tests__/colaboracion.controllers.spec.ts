import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  AlternarEstadoApiKeyUseCase,
  CrearApiKeyUseCase,
  EliminarApiKeysUseCase,
  ListApiKeysUseCase,
  RegenerarApiKeyUseCase,
  RenombrarApiKeyUseCase,
} from '../../../application/use-cases/api-keys.use-cases';
import {
  EliminarEventoUseCase,
  GetPermisosCalendarioUseCase,
  GuardarEventoUseCase,
  ListEventosUseCase,
} from '../../../application/use-cases/calendario.use-cases';
import {
  EnviarMensajeChatUseCase,
  GetConversacionUseCase,
  ListContactosChatUseCase,
  MarcarConversacionLeidaUseCase,
} from '../../../application/use-cases/chat.use-cases';
import {
  ContarCorreosNoLeidosUseCase,
  GetCorreoUseCase,
  ListBuzonUseCase,
  RedactarCorreoUseCase,
} from '../../../application/use-cases/correo.use-cases';
import {
  CambiarEstadoTareaUseCase,
  EliminarTareaUseCase,
  GetEstadisticasTareasUseCase,
  GetKanbanUseCase,
  GetTareaUseCase,
  GuardarTareaUseCase,
  ListTareasUseCase,
} from '../../../application/use-cases/tareas.use-cases';
import { ListUsuariosUseCase } from '../../../application/use-cases/usuarios.use-cases';
import { ApiKeysController } from '../api-keys.controller';
import { CalendarioController } from '../calendario.controller';
import { ChatController } from '../chat.controller';
import { CorreoController } from '../correo.controller';
import { TareasController } from '../tareas.controller';
import { UsuariosColaboracionController } from '../usuarios.controller';

const mock = (value: unknown = []) => ({ execute: jest.fn().mockResolvedValue(value) });

function providers() {
  const m = {
    guardarTarea: mock({ id: 1, titulo: 'T' }),
    cambiarEstado: mock({ id: 1, estado: 'Completed' }),
    guardarEvento: mock({ id: 1 }),
    enviarMensaje: mock({ id: 1 }),
    redactar: mock({ id: 1, notificacionExternaEnviada: true }),
    crearKey: mock({ id: 1 }),
    eliminarKeys: mock({ eliminadas: 2 }),
  };
  const list = [
    { provide: ListTareasUseCase, useValue: mock() },
    { provide: GetKanbanUseCase, useValue: mock({}) },
    { provide: GetEstadisticasTareasUseCase, useValue: mock({ total: 0 }) },
    { provide: GetTareaUseCase, useValue: mock({ id: 1 }) },
    { provide: GuardarTareaUseCase, useValue: m.guardarTarea },
    { provide: CambiarEstadoTareaUseCase, useValue: m.cambiarEstado },
    { provide: EliminarTareaUseCase, useValue: mock(undefined) },
    { provide: ListEventosUseCase, useValue: mock() },
    { provide: GuardarEventoUseCase, useValue: m.guardarEvento },
    { provide: EliminarEventoUseCase, useValue: mock(undefined) },
    { provide: GetPermisosCalendarioUseCase, useValue: mock({ puedeCrearGenerales: false }) },
    { provide: ListContactosChatUseCase, useValue: mock() },
    { provide: GetConversacionUseCase, useValue: mock() },
    { provide: EnviarMensajeChatUseCase, useValue: m.enviarMensaje },
    { provide: MarcarConversacionLeidaUseCase, useValue: mock(undefined) },
    { provide: ListBuzonUseCase, useValue: mock() },
    { provide: GetCorreoUseCase, useValue: mock({ id: 1 }) },
    { provide: RedactarCorreoUseCase, useValue: m.redactar },
    { provide: ContarCorreosNoLeidosUseCase, useValue: mock(3) },
    { provide: ListApiKeysUseCase, useValue: mock() },
    { provide: CrearApiKeyUseCase, useValue: m.crearKey },
    { provide: RenombrarApiKeyUseCase, useValue: mock({ id: 1 }) },
    { provide: RegenerarApiKeyUseCase, useValue: mock({ id: 1 }) },
    { provide: AlternarEstadoApiKeyUseCase, useValue: mock({ id: 1 }) },
    { provide: EliminarApiKeysUseCase, useValue: m.eliminarKeys },
    { provide: ListUsuariosUseCase, useValue: mock([{ id: 1, nombre: 'Admin' }]) },
  ];
  return { m, list };
}

const controllers = [
  TareasController,
  CalendarioController,
  ChatController,
  CorreoController,
  ApiKeysController,
  UsuariosColaboracionController,
];

describe('Controladores de Colaboración (HTTP)', () => {
  let app: INestApplication;
  let p: ReturnType<typeof providers>;

  beforeAll(async () => {
    p = providers();
    app = await createTestApp({ controllers, providers: p.list, actor: funcionarioActor });
  });
  afterAll(() => app.close());

  describe('Tareas', () => {
    it('GET /colaboracion/tareas, /kanban, /estadisticas y /:id', async () => {
      await request(app.getHttpServer()).get('/colaboracion/tareas').expect(200, []);
      await request(app.getHttpServer()).get('/colaboracion/tareas/kanban').expect(200);
      await request(app.getHttpServer()).get('/colaboracion/tareas/estadisticas').expect(200);
      await request(app.getHttpServer()).get('/colaboracion/tareas/5').expect(200);
      await request(app.getHttpServer()).get('/colaboracion/tareas/abc').expect(400);
    });

    it('POST /colaboracion/tareas valida el cuerpo y pasa el actor', async () => {
      await request(app.getHttpServer())
        .post('/colaboracion/tareas')
        .send({ titulo: 'Nueva', asignadoIds: [2], prioridad: 'Alta' })
        .expect(201);
      expect(p.m.guardarTarea.execute).toHaveBeenCalledWith({
        actor: expect.objectContaining({ id: funcionarioActor.id }),
        input: { titulo: 'Nueva', asignadoIds: [2], prioridad: 'Alta' },
      });
      await request(app.getHttpServer()).post('/colaboracion/tareas').send({ titulo: '', estado: 'Raro' }).expect(400);
      await request(app.getHttpServer())
        .post('/colaboracion/tareas')
        .send({ titulo: 'X', fechaLimite: '31/10/2026' })
        .expect(400);
    });

    it('PATCH /colaboracion/tareas/:id/estado exige un estado válido', async () => {
      await request(app.getHttpServer())
        .patch('/colaboracion/tareas/1/estado')
        .send({ estado: 'Completed' })
        .expect(200);
      expect(p.m.cambiarEstado.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 1, estado: 'Completed' }));
      await request(app.getHttpServer()).patch('/colaboracion/tareas/1/estado').send({ estado: 'Otro' }).expect(400);
    });

    it('DELETE /colaboracion/tareas/:id responde 204', async () => {
      await request(app.getHttpServer()).delete('/colaboracion/tareas/1').expect(204);
    });
  });

  describe('Calendario', () => {
    it('GET /colaboracion/calendario/eventos acepta rango', async () => {
      await request(app.getHttpServer())
        .get('/colaboracion/calendario/eventos?desde=2026-10-01&hasta=2026-10-31')
        .expect(200, []);
    });
    it('POST valida título e inicio', async () => {
      await request(app.getHttpServer())
        .post('/colaboracion/calendario/eventos')
        .send({ titulo: 'Reunión', inicio: '2026-10-15T09:00', todoElDia: false })
        .expect(201);
      await request(app.getHttpServer())
        .post('/colaboracion/calendario/eventos')
        .send({ titulo: 'Reunión', inicio: 'mañana' })
        .expect(400);
      await request(app.getHttpServer())
        .put('/colaboracion/calendario/eventos/3')
        .send({ titulo: 'R', inicio: '2026-10-15' })
        .expect(200);
      expect(p.m.guardarEvento.execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ input: expect.objectContaining({ id: 3 }) }),
      );
      await request(app.getHttpServer()).delete('/colaboracion/calendario/eventos/3').expect(204);
    });
  });

  describe('Chat', () => {
    it('contactos, conversación, leer y enviar', async () => {
      await request(app.getHttpServer()).get('/colaboracion/chat/contactos').expect(200);
      await request(app.getHttpServer()).get('/colaboracion/chat/conversacion/3').expect(200);
      await request(app.getHttpServer()).post('/colaboracion/chat/conversacion/3/leer').expect(204);
      await request(app.getHttpServer())
        .post('/colaboracion/chat/mensajes')
        .send({ receptorId: 3, mensaje: 'Hola' })
        .expect(201);
      expect(p.m.enviarMensaje.execute).toHaveBeenCalledWith(
        expect.objectContaining({ receptorId: 3, mensaje: 'Hola' }),
      );
      await request(app.getHttpServer())
        .post('/colaboracion/chat/mensajes')
        .send({ receptorId: 3, mensaje: '' })
        .expect(400);
    });
  });

  describe('Correo', () => {
    it('buzón, no leídos, ver y redactar', async () => {
      await request(app.getHttpServer()).get('/colaboracion/correo?carpeta=sent').expect(200);
      await request(app.getHttpServer()).get('/colaboracion/correo/no-leidos').expect(200, { total: 3 });
      await request(app.getHttpServer()).get('/colaboracion/correo/9').expect(200);
      await request(app.getHttpServer())
        .post('/colaboracion/correo')
        .send({ paraEmail: 'a@b.co', asunto: 'A', cuerpo: 'B' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/colaboracion/correo')
        .send({ paraEmail: 'no-es-correo', asunto: 'A', cuerpo: 'B' })
        .expect(400);
    });
  });

  describe('API keys', () => {
    it('CRUD, regenerar, alternar y eliminar múltiples', async () => {
      await request(app.getHttpServer()).get('/colaboracion/api-keys').expect(200);
      await request(app.getHttpServer()).post('/colaboracion/api-keys').send({ nombre: 'Integración' }).expect(201);
      await request(app.getHttpServer()).post('/colaboracion/api-keys').send({ nombre: '' }).expect(400);
      await request(app.getHttpServer()).put('/colaboracion/api-keys/1').send({ nombre: 'Otro' }).expect(200);
      await request(app.getHttpServer()).post('/colaboracion/api-keys/1/regenerar').expect(200);
      await request(app.getHttpServer()).post('/colaboracion/api-keys/1/alternar-estado').expect(200);
      await request(app.getHttpServer())
        .post('/colaboracion/api-keys/eliminar-multiples')
        .send({ ids: [1, 2] })
        .expect(200, { eliminadas: 2 });
      await request(app.getHttpServer())
        .post('/colaboracion/api-keys/eliminar-multiples')
        .send({ ids: [] })
        .expect(400);
      await request(app.getHttpServer()).delete('/colaboracion/api-keys/1').expect(204);
      expect(p.m.eliminarKeys.execute).toHaveBeenLastCalledWith(expect.objectContaining({ ids: [1] }));
    });
  });

  it('GET /colaboracion/usuarios devuelve el directorio', async () => {
    await request(app.getHttpServer())
      .get('/colaboracion/usuarios')
      .expect(200, [{ id: 1, nombre: 'Admin' }]);
  });

  it('sin sesión responde 403 (guard de pruebas)', async () => {
    const anon = await createTestApp({ controllers, providers: providers().list, actor: null });
    await request(anon.getHttpServer()).get('/colaboracion/tareas').expect(403);
    await anon.close();
    expect(adminActor.role).toBe('admin');
  });
});
