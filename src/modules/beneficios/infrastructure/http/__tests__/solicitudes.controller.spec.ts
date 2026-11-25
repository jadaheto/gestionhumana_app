import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InvalidOperationError } from '../../../../../shared/domain/domain-error';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  AprobarSolicitudUseCase,
  CrearSolicitudUseCase,
  EsJefeUseCase,
  ListarMisSolicitudesUseCase,
  ListarSolicitudesAdminUseCase,
  ListarSolicitudesJefeUseCase,
  RechazarSolicitudUseCase,
  ResolverSolicitudComoJefeUseCase,
  SuspenderVacacionesUseCase,
} from '../../../application/use-cases/solicitudes.use-cases';
import { SolicitudesController } from '../solicitudes.controller';

function providers() {
  const crear = { execute: jest.fn().mockResolvedValue({ id: 1, estado: 'pendiente' }) };
  const aprobar = { execute: jest.fn().mockResolvedValue({ id: 1, estado: 'aprobado' }) };
  const rechazar = { execute: jest.fn().mockResolvedValue({ id: 1, estado: 'rechazado' }) };
  const suspender = {
    execute: jest.fn().mockResolvedValue({ diasTotales: 10, diasDisfrutados: 3, diasReintegrados: 7, message: 'ok' }),
  };
  const listarMias = { execute: jest.fn().mockResolvedValue([]) };
  const listarAdmin = { execute: jest.fn().mockResolvedValue([]) };
  const listarJefe = { execute: jest.fn().mockResolvedValue([]) };
  const resolverJefe = { execute: jest.fn().mockResolvedValue({ id: 1, estado: 'pendiente', jefeEstado: 'aprobado' }) };
  return {
    crear,
    aprobar,
    rechazar,
    suspender,
    listarMias,
    listarAdmin,
    listarJefe,
    resolverJefe,
    list: [
      { provide: EsJefeUseCase, useValue: { execute: jest.fn().mockResolvedValue({ esJefe: true }) } },
      { provide: ListarSolicitudesJefeUseCase, useValue: listarJefe },
      { provide: ResolverSolicitudComoJefeUseCase, useValue: resolverJefe },
      { provide: CrearSolicitudUseCase, useValue: crear },
      { provide: ListarMisSolicitudesUseCase, useValue: listarMias },
      { provide: ListarSolicitudesAdminUseCase, useValue: listarAdmin },
      { provide: AprobarSolicitudUseCase, useValue: aprobar },
      { provide: RechazarSolicitudUseCase, useValue: rechazar },
      { provide: SuspenderVacacionesUseCase, useValue: suspender },
    ],
  };
}

describe('SolicitudesController (HTTP)', () => {
  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [SolicitudesController], providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('el jefe inmediato lista y responde las solicitudes de su equipo', async () => {
      await request(app.getHttpServer()).get('/solicitudes/jefe?estado=pendiente').expect(200, []);
      expect(p.listarJefe.execute).toHaveBeenCalledWith({ actor: funcionarioActor, estado: 'pendiente' });
      await request(app.getHttpServer()).get('/solicitudes/jefe?estado=raro').expect(400);
      await request(app.getHttpServer()).get('/solicitudes/jefe/estado').expect(200, { esJefe: true });
      await request(app.getHttpServer())
        .post('/solicitudes/5/jefe/aprobar')
        .send({ observacion: 'De acuerdo' })
        .expect(200);
      expect(p.resolverJefe.execute).toHaveBeenLastCalledWith({
        actor: funcionarioActor,
        permisoId: 5,
        observacion: 'De acuerdo',
        aprobar: true,
      });
      await request(app.getHttpServer()).post('/solicitudes/5/jefe/rechazar').send({}).expect(200);
      expect(p.resolverJefe.execute).toHaveBeenLastCalledWith({
        actor: funcionarioActor,
        permisoId: 5,
        observacion: null,
        aprobar: false,
      });
    });

    it('GET /solicitudes/mis-permisos lista las propias usando el actor', async () => {
      await request(app.getHttpServer()).get('/solicitudes/mis-permisos').expect(200, []);
      expect(p.listarMias.execute).toHaveBeenCalledWith(funcionarioActor);
    });

    it('POST /solicitudes crea con multipart y pasa el archivo al caso de uso', async () => {
      await request(app.getHttpServer())
        .post('/solicitudes')
        .field('tipoPermiso', 'incapacidad')
        .field('fechaInicio', '2026-03-02T08:00')
        .field('fechaFin', '2026-03-04T17:00')
        .field('horas', '')
        .field('justificacion', 'Reposo médico')
        .attach('archivoSoporte', Buffer.from('%PDF-1.4'), 'soporte.pdf')
        .expect(201);
      const input = p.crear.execute.mock.calls[0][0];
      expect(input.actor).toEqual(funcionarioActor);
      expect(input.tipoPermiso).toBe('incapacidad');
      expect(input.horas).toBeNull();
      expect(input.archivo).toMatchObject({ originalName: 'soporte.pdf', mimeType: 'application/pdf' });
      expect(Buffer.isBuffer(input.archivo.buffer)).toBe(true);
    });

    it('POST /solicitudes acepta JSON sin archivo y convierte horas a número', async () => {
      await request(app.getHttpServer())
        .post('/solicitudes')
        .send({
          tipoPermiso: 'personal',
          fechaInicio: '2026-03-02T08:00',
          fechaFin: '2026-03-02T12:00',
          horas: '4',
          justificacion: 'Cita',
        })
        .expect(201);
      const input = p.crear.execute.mock.calls.at(-1)![0];
      expect(input.horas).toBe(4);
      expect(input.archivo).toBeNull();
    });

    it('POST /solicitudes valida tipo, fechas y justificación (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/solicitudes')
        .send({ tipoPermiso: 'sabatico', fechaInicio: '02/03/2026', fechaFin: '', justificacion: '' })
        .expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('no puede acceder a los endpoints de administración (403)', async () => {
      await request(app.getHttpServer()).get('/solicitudes/admin').expect(403);
      await request(app.getHttpServer()).post('/solicitudes/1/aprobar').send({}).expect(403);
      await request(app.getHttpServer()).post('/solicitudes/1/rechazar').send({}).expect(403);
      await request(app.getHttpServer())
        .post('/solicitudes/1/suspender-vacaciones')
        .send({ diasDisfrutados: 1 })
        .expect(403);
    });
  });

  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [SolicitudesController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /solicitudes/admin?estado=pendiente filtra por estado', async () => {
      await request(app.getHttpServer()).get('/solicitudes/admin?estado=pendiente').expect(200);
      expect(p.listarAdmin.execute).toHaveBeenCalledWith({ estado: 'pendiente' });
      await request(app.getHttpServer()).get('/solicitudes/admin?estado=otro').expect(400);
    });

    it('POST /solicitudes/:id/aprobar responde 200 con la observación', async () => {
      await request(app.getHttpServer()).post('/solicitudes/5/aprobar').send({ observacion: 'Ok' }).expect(200);
      expect(p.aprobar.execute).toHaveBeenCalledWith({ actor: adminActor, permisoId: 5, observacion: 'Ok' });
    });

    it('POST /solicitudes/:id/aprobar traduce InvalidOperationError a 422', async () => {
      p.aprobar.execute.mockRejectedValueOnce(new InvalidOperationError('La solicitud ya fue procesada.'));
      const res = await request(app.getHttpServer()).post('/solicitudes/5/aprobar').send({}).expect(422);
      expect(res.body).toMatchObject({ code: 'INVALID_OPERATION', message: 'La solicitud ya fue procesada.' });
    });

    it('POST /solicitudes/:id/rechazar responde 200', async () => {
      await request(app.getHttpServer()).post('/solicitudes/7/rechazar').send({ observacion: '' }).expect(200);
      expect(p.rechazar.execute).toHaveBeenCalledWith({ actor: adminActor, permisoId: 7, observacion: null });
    });

    it('POST /solicitudes/:id/suspender-vacaciones valida diasDisfrutados >= 1', async () => {
      await request(app.getHttpServer())
        .post('/solicitudes/7/suspender-vacaciones')
        .send({ diasDisfrutados: 0 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/solicitudes/7/suspender-vacaciones')
        .send({ diasDisfrutados: '3', motivo: 'Urgencia' })
        .expect(200);
      expect(p.suspender.execute).toHaveBeenCalledWith({
        actor: adminActor,
        permisoId: 7,
        diasDisfrutados: 3,
        motivo: 'Urgencia',
      });
    });

    it('rechaza ids no numéricos (400)', async () => {
      await request(app.getHttpServer()).post('/solicitudes/abc/aprobar').send({}).expect(400);
    });
  });
});
