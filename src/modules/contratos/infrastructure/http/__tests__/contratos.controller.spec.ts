import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  EliminarContratoUseCase,
  GuardarContratoUseCase,
  ListarColaboradoresUseCase,
  ListarContratosUseCase,
  ListarProrrogasUseCase,
  ObtenerContratoUseCase,
  RegistrarProrrogaUseCase,
} from '../../../application/use-cases/contratos.use-cases';
import { GenerarDocumentoContratoUseCase } from '../../../application/use-cases/generar-documento-contrato.use-case';
import { ContratosController } from '../contratos.controller';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8, 0)]);

function providers() {
  const listar = { execute: jest.fn().mockResolvedValue([{ id: 1 }]) };
  const guardar = { execute: jest.fn().mockResolvedValue({ id: 1, numeroContrato: 'CT-1' }) };
  const prorrogar = {
    execute: jest
      .fn()
      .mockResolvedValue({ contratoId: 1, fechaFinAnterior: '2026-10-31', fechaFinNueva: '2026-12-31', meses: 2 }),
  };
  const generar = {
    execute: jest.fn().mockResolvedValue({
      filename: 'Preaviso_Terminacion_1.pdf',
      mimeType: 'application/pdf',
      contenido: Buffer.from('%PDF-1.4 test'),
    }),
  };
  const obtener = { execute: jest.fn().mockResolvedValue({ id: 1 }) };
  return {
    listar,
    guardar,
    prorrogar,
    generar,
    obtener,
    list: [
      { provide: ListarContratosUseCase, useValue: listar },
      { provide: ObtenerContratoUseCase, useValue: obtener },
      { provide: GuardarContratoUseCase, useValue: guardar },
      { provide: EliminarContratoUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: RegistrarProrrogaUseCase, useValue: prorrogar },
      { provide: ListarProrrogasUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
      {
        provide: ListarColaboradoresUseCase,
        useValue: {
          execute: jest
            .fn()
            .mockResolvedValue([{ id: 2, firstName: 'Juan', lastName: 'Pérez', cedula: '1', cargoNombre: null }]),
        },
      },
      { provide: GenerarDocumentoContratoUseCase, useValue: generar },
    ],
  };
}

const cuerpo = {
  userId: 2,
  tipoContrato: 'fijo',
  numeroContrato: 'CT-1',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  salarioBase: 2500000,
};

describe('ContratosController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [ContratosController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /contratos lista pasando el actor', async () => {
      await request(app.getHttpServer())
        .get('/contratos')
        .expect(200, [{ id: 1 }]);
      expect(p.listar.execute).toHaveBeenCalledWith({ actor: adminActor });
    });

    it('GET /contratos/colaboradores devuelve el listado para el select', async () => {
      const res = await request(app.getHttpServer()).get('/contratos/colaboradores').expect(200);
      expect(res.body[0]).toMatchObject({ id: 2, firstName: 'Juan' });
    });

    it('GET /contratos/:id pasa actor e id', async () => {
      await request(app.getHttpServer()).get('/contratos/5').expect(200);
      expect(p.obtener.execute).toHaveBeenCalledWith({ actor: adminActor, id: 5 });
      await request(app.getHttpServer()).get('/contratos/abc').expect(400);
    });

    it('POST /contratos crea normalizando opcionales', async () => {
      await request(app.getHttpServer()).post('/contratos').send(cuerpo).expect(201);
      expect(p.guardar.execute).toHaveBeenCalledWith({ ...cuerpo, estado: 'activo', observaciones: null });
    });

    it('POST /contratos valida el cuerpo (400 con lista de mensajes)', async () => {
      const res = await request(app.getHttpServer())
        .post('/contratos')
        .send({ ...cuerpo, tipoContrato: 'raro', fechaInicio: '01/01/2026', salarioBase: 0 })
        .expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.join(' ')).toContain('fechaInicio');
    });

    it('PUT /contratos/:id actualiza y traduce errores de dominio', async () => {
      await request(app.getHttpServer())
        .put('/contratos/3')
        .send({ ...cuerpo, fechaFin: '', estado: 'renovado' })
        .expect(200);
      expect(p.guardar.execute).toHaveBeenLastCalledWith({
        ...cuerpo,
        id: 3,
        fechaFin: null,
        estado: 'renovado',
        observaciones: null,
      });
      p.guardar.execute.mockRejectedValueOnce(
        new ValidationError('La fecha fin no puede ser anterior a la fecha de inicio.'),
      );
      const res = await request(app.getHttpServer()).put('/contratos/3').send(cuerpo).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('DELETE /contratos/:id responde 204', async () => {
      await request(app.getHttpServer()).delete('/contratos/3').expect(204);
    });

    it('POST /contratos/:id/prorrogas exige meses >= 1 y devuelve la nueva fecha fin', async () => {
      await request(app.getHttpServer()).post('/contratos/1/prorrogas').send({ meses: 0 }).expect(400);
      const res = await request(app.getHttpServer())
        .post('/contratos/1/prorrogas')
        .send({ meses: 2, observacion: 'ok' })
        .expect(201);
      expect(res.body.fechaFinNueva).toBe('2026-12-31');
      expect(p.prorrogar.execute).toHaveBeenCalledWith({
        actor: adminActor,
        contratoId: 1,
        meses: 2,
        observacion: 'ok',
      });
    });

    it('POST /contratos/:id/documentos recibe multipart con firma y devuelve PDF', async () => {
      const res = await request(app.getHttpServer())
        .post('/contratos/1/documentos')
        .field('tipo', 'prorroga')
        .field('meses', '2')
        .field('numero', '1')
        .field('firmanteNombre', 'GERENTE')
        .attach('firmaPng', PNG, 'firma.png')
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('Preaviso_Terminacion_1.pdf');
      const input = p.generar.execute.mock.calls[0][0];
      expect(input).toMatchObject({
        contratoId: 1,
        tipo: 'prorroga',
        meses: 2,
        numero: 1,
        firmanteNombre: 'GERENTE',
        firmaPngNombre: 'firma.png',
      });
      expect(Buffer.isBuffer(input.firmaPng)).toBe(true);
    });

    it('POST /contratos/:id/documentos rechaza tipos desconocidos', async () => {
      await request(app.getHttpServer()).post('/contratos/1/documentos').field('tipo', 'otro').expect(400);
    });

    it('GET /contratos/:id/documentos/{preaviso,prorroga,renovacion} devuelven PDF con parámetros', async () => {
      await request(app.getHttpServer())
        .get('/contratos/1/documentos/preaviso')
        .expect(200)
        .expect('Content-Type', /pdf/);
      await request(app.getHttpServer()).get('/contratos/1/documentos/prorroga?meses=4&numero=2').expect(200);
      expect(p.generar.execute).toHaveBeenLastCalledWith({ contratoId: 1, tipo: 'prorroga', meses: 4, numero: 2 });
      await request(app.getHttpServer()).get('/contratos/1/documentos/renovacion?anios=3').expect(200);
      expect(p.generar.execute).toHaveBeenLastCalledWith({ contratoId: 1, tipo: 'renovacion', anios: 3 });
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [ContratosController], providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('puede listar (el caso de uso filtra por actor) y ver detalle', async () => {
      await request(app.getHttpServer()).get('/contratos').expect(200);
      expect(p.listar.execute).toHaveBeenCalledWith({ actor: funcionarioActor });
      await request(app.getHttpServer()).get('/contratos/1').expect(200);
    });

    it('no puede crear, editar, eliminar, prorrogar, generar cartas ni listar colaboradores (403)', async () => {
      const server = app.getHttpServer();
      await request(server).post('/contratos').send(cuerpo).expect(403);
      await request(server).put('/contratos/1').send(cuerpo).expect(403);
      await request(server).delete('/contratos/1').expect(403);
      await request(server).post('/contratos/1/prorrogas').send({ meses: 1 }).expect(403);
      await request(server).post('/contratos/1/documentos').field('tipo', 'preaviso').expect(403);
      await request(server).get('/contratos/1/documentos/preaviso').expect(403);
      const res = await request(server).get('/contratos/colaboradores').expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
