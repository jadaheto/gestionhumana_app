import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConflictError } from '../../../../../shared/domain/domain-error';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  CreateColaboradorUseCase,
  DeleteColaboradorUseCase,
  GetColaboradorUseCase,
  ListColaboradoresUseCase,
  UpdateColaboradorUseCase,
  UploadFotoColaboradorUseCase,
} from '../../../application/use-cases/colaboradores.use-cases';
import { ColaboradoresController } from '../colaboradores.controller';

const body = {
  firstName: 'Ana',
  lastName: 'Gómez',
  email: 'ana@comfasucre.com.co',
  cedula: '2002',
  sedeId: '1',
  fechaIngreso: '2025-02-01',
  codigoEmpresa: '',
};

describe('ColaboradoresController (HTTP)', () => {
  const list = { execute: jest.fn() };
  const get = { execute: jest.fn() };
  const create = { execute: jest.fn() };
  const update = { execute: jest.fn() };
  const foto = { execute: jest.fn() };
  const del = { execute: jest.fn() };
  const providers = [
    { provide: ListColaboradoresUseCase, useValue: list },
    { provide: GetColaboradorUseCase, useValue: get },
    { provide: CreateColaboradorUseCase, useValue: create },
    { provide: UpdateColaboradorUseCase, useValue: update },
    { provide: UploadFotoColaboradorUseCase, useValue: foto },
    { provide: DeleteColaboradorUseCase, useValue: del },
  ];

  describe('como administrador', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({ controllers: [ColaboradoresController], providers, actor: adminActor });
    });
    afterAll(() => app.close());
    beforeEach(() => jest.clearAllMocks());

    it('GET /colaboradores pasa los filtros convertidos', async () => {
      list.execute.mockResolvedValue([]);
      await request(app.getHttpServer()).get('/colaboradores?estado=activo&areaId=3&sedeId=').expect(200, []);
      expect(list.execute).toHaveBeenCalledWith({ estado: 'activo', areaId: 3, sedeId: undefined });
    });

    it('GET /colaboradores rechaza filtros inválidos', async () => {
      await request(app.getHttpServer()).get('/colaboradores?estado=raro').expect(400);
    });

    it('POST /colaboradores normaliza opcionales a null y devuelve la contraseña temporal', async () => {
      create.execute.mockResolvedValue({ colaborador: { id: 5 }, username: 'agomez', temporaryPassword: 'Temp1234!' });
      const res = await request(app.getHttpServer()).post('/colaboradores').send(body).expect(201);
      expect(res.body.temporaryPassword).toBe('Temp1234!');
      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Ana',
          sedeId: 1,
          codigoEmpresa: null,
          estadoColaborador: 'activo',
          username: null,
          password: null,
          telefono: null,
        }),
      );
    });

    it('POST /colaboradores valida el cuerpo (400) y traduce duplicados (409)', async () => {
      await request(app.getHttpServer())
        .post('/colaboradores')
        .send({ ...body, email: 'no', cedula: '' })
        .expect(400);
      create.execute.mockRejectedValue(new ConflictError('La cédula ya está registrada en otro colaborador.'));
      const res = await request(app.getHttpServer()).post('/colaboradores').send(body).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'La cédula ya está registrada en otro colaborador.',
      });
    });

    it('PUT /colaboradores/:id actualiza', async () => {
      update.execute.mockResolvedValue({ id: 7 });
      await request(app.getHttpServer()).put('/colaboradores/7').send(body).expect(200);
      expect(update.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 7, firstName: 'Ana' }));
    });

    it('POST /colaboradores/:id/foto exige archivo y lo entrega al caso de uso', async () => {
      await request(app.getHttpServer()).post('/colaboradores/7/foto').expect(400);
      foto.execute.mockResolvedValue({ id: 7, profileImage: 'profile/x.png' });
      await request(app.getHttpServer())
        .post('/colaboradores/7/foto')
        .attach('file', Buffer.from('img'), 'foto.png')
        .expect(201);
      expect(foto.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 7, originalName: 'foto.png' }));
    });

    it('DELETE /colaboradores/:id responde 204 con el actor', async () => {
      del.execute.mockResolvedValue(undefined);
      await request(app.getHttpServer()).delete('/colaboradores/9').expect(204);
      expect(del.execute).toHaveBeenCalledWith({ actor: adminActor, id: 9 });
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({ controllers: [ColaboradoresController], providers, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('no puede acceder (403)', async () => {
      await request(app.getHttpServer()).get('/colaboradores').expect(403);
      await request(app.getHttpServer()).post('/colaboradores').send(body).expect(403);
    });
  });
});
