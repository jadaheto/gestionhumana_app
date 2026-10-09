import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  ListarColaboradoresUseCase,
  ListarIncapacidadesUseCase,
  RegistrarIncapacidadUseCase,
} from '../../../application/use-cases/incapacidades.use-cases';
import { ListarMisSolicitudesUseCase } from '../../../application/use-cases/solicitudes.use-cases';
import {
  GetResumenVacacionesUseCase,
  ListarVacacionesUseCase,
} from '../../../application/use-cases/vacaciones.use-cases';
import { BeneficiosController } from '../beneficios.controller';

function providers() {
  const resumen = { execute: jest.fn().mockResolvedValue({ userId: 2, saldo: { diasPendientes: 10 } }) };
  const registrar = { execute: jest.fn().mockResolvedValue({ id: 1, estado: 'activo' }) };
  const listarVacaciones = { execute: jest.fn().mockResolvedValue([]) };
  const listarPermisos = { execute: jest.fn().mockResolvedValue([]) };
  const listarIncapacidades = { execute: jest.fn().mockResolvedValue([]) };
  const colaboradores = { execute: jest.fn().mockResolvedValue([{ id: 2, nombre: 'Juan Pérez', cedula: '1' }]) };
  return {
    resumen,
    registrar,
    listarVacaciones,
    listarPermisos,
    listarIncapacidades,
    colaboradores,
    list: [
      { provide: ListarVacacionesUseCase, useValue: listarVacaciones },
      { provide: GetResumenVacacionesUseCase, useValue: resumen },
      { provide: ListarMisSolicitudesUseCase, useValue: listarPermisos },
      { provide: ListarIncapacidadesUseCase, useValue: listarIncapacidades },
      { provide: RegistrarIncapacidadUseCase, useValue: registrar },
      { provide: ListarColaboradoresUseCase, useValue: colaboradores },
    ],
  };
}

describe('BeneficiosController (HTTP)', () => {
  describe('como funcionario', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [BeneficiosController], providers: p.list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('GET /beneficios/vacaciones, /permisos e /incapacidades usan el actor', async () => {
      await request(app.getHttpServer()).get('/beneficios/vacaciones').expect(200, []);
      await request(app.getHttpServer()).get('/beneficios/permisos').expect(200, []);
      await request(app.getHttpServer()).get('/beneficios/incapacidades').expect(200, []);
      expect(p.listarVacaciones.execute).toHaveBeenCalledWith(funcionarioActor);
      expect(p.listarPermisos.execute).toHaveBeenCalledWith(funcionarioActor);
      expect(p.listarIncapacidades.execute).toHaveBeenCalledWith(funcionarioActor);
    });

    it('GET /beneficios/vacaciones/saldo devuelve el resumen propio', async () => {
      const res = await request(app.getHttpServer()).get('/beneficios/vacaciones/saldo').expect(200);
      expect(res.body.saldo.diasPendientes).toBe(10);
      expect(p.resumen.execute).toHaveBeenCalledWith({ actor: funcionarioActor });
    });

    it('no puede consultar el saldo de otro ni el listado de colaboradores (403)', async () => {
      await request(app.getHttpServer()).get('/beneficios/vacaciones/saldo/1').expect(403);
      await request(app.getHttpServer()).get('/beneficios/colaboradores').expect(403);
    });

    it('POST /beneficios/incapacidades registra con multipart y adjunto', async () => {
      await request(app.getHttpServer())
        .post('/beneficios/incapacidades')
        .field('tipo', 'enfermedad_general')
        .field('fechaInicio', '2026-03-02')
        .field('fechaFin', '2026-03-04')
        .field('dias', '3')
        .field('entidadEmisora', 'EPS')
        .field('numeroIncapacidad', '')
        .attach('archivoSoporte', Buffer.from('png'), 'soporte.png')
        .expect(201);
      const input = p.registrar.execute.mock.calls[0][0];
      expect(input).toMatchObject({
        actor: funcionarioActor,
        userId: null,
        tipo: 'enfermedad_general',
        dias: 3,
        entidadEmisora: 'EPS',
        numeroIncapacidad: null,
      });
      expect(input.archivo.originalName).toBe('soporte.png');
    });

    it('POST /beneficios/incapacidades valida fechas y tipo (400)', async () => {
      await request(app.getHttpServer())
        .post('/beneficios/incapacidades')
        .send({ tipo: 'x', fechaInicio: '2026-03-02T08:00', fechaFin: '2026-03-04' })
        .expect(400);
    });
  });

  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [BeneficiosController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /beneficios/vacaciones/saldo/:userId consulta a otro usuario', async () => {
      await request(app.getHttpServer()).get('/beneficios/vacaciones/saldo/2').expect(200);
      expect(p.resumen.execute).toHaveBeenCalledWith({ actor: adminActor, userId: 2 });
    });

    it('GET /beneficios/colaboradores lista para el select', async () => {
      const res = await request(app.getHttpServer()).get('/beneficios/colaboradores').expect(200);
      expect(res.body).toEqual([{ id: 2, nombre: 'Juan Pérez', cedula: '1' }]);
    });

    it('POST /beneficios/incapacidades permite indicar userId', async () => {
      await request(app.getHttpServer())
        .post('/beneficios/incapacidades')
        .send({ userId: '5', tipo: 'maternidad', fechaInicio: '2026-03-02', fechaFin: '2026-05-30' })
        .expect(201);
      expect(p.registrar.execute.mock.calls[0][0]).toMatchObject({
        actor: adminActor,
        userId: 5,
        tipo: 'maternidad',
        dias: null,
        archivo: null,
      });
    });
  });
});
