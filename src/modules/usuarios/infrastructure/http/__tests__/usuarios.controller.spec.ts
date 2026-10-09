import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InvalidOperationError } from '../../../../../shared/domain/domain-error';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  CreateUsuarioUseCase,
  DeleteUsuarioUseCase,
  GetUsuarioUseCase,
  ListUsuariosUseCase,
  ResetPasswordUsuarioUseCase,
  UpdateUsuarioUseCase,
} from '../../../application/use-cases/usuarios.use-cases';
import { UsuariosController } from '../usuarios.controller';

function providers() {
  const crear = { execute: jest.fn().mockResolvedValue({ id: 5, username: 'nuevo', temporaryPassword: 'Temp1234!' }) };
  const restablecer = { execute: jest.fn().mockResolvedValue({ temporaryPassword: 'Temp1234!', message: 'ok' }) };
  const eliminar = {
    execute: jest
      .fn()
      .mockImplementation(({ id, actor }: { id: number; actor: { id: number } }) =>
        id === actor.id
          ? Promise.reject(new InvalidOperationError('No puedes eliminar tu propio usuario.'))
          : Promise.resolve(),
      ),
  };
  return {
    crear,
    restablecer,
    eliminar,
    list: [
      { provide: ListUsuariosUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
      { provide: GetUsuarioUseCase, useValue: { execute: jest.fn().mockResolvedValue({ id: 1 }) } },
      { provide: CreateUsuarioUseCase, useValue: crear },
      { provide: UpdateUsuarioUseCase, useValue: { execute: jest.fn().mockResolvedValue({ id: 1 }) } },
      { provide: ResetPasswordUsuarioUseCase, useValue: restablecer },
      { provide: DeleteUsuarioUseCase, useValue: eliminar },
    ],
  };
}

const body = {
  username: 'nuevo',
  email: 'nuevo@x.com',
  firstName: 'Nuevo',
  lastName: 'Usuario',
  role: 'funcionario',
  sedeId: 1,
};

describe('UsuariosController (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers: [UsuariosController], providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET /usuarios lista', async () => {
      await request(app.getHttpServer()).get('/usuarios').expect(200, []);
    });

    it('POST /usuarios crea y devuelve la contraseña temporal', async () => {
      const res = await request(app.getHttpServer()).post('/usuarios').send(body).expect(201);
      expect(res.body.temporaryPassword).toBe('Temp1234!');
      expect(p.crear.execute).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'nuevo', password: null, sedeId: 1, areaId: null, cargoId: null }),
      );
    });

    it('POST /usuarios valida cuerpo (rol inválido, username con espacios, correo inválido)', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .send({ ...body, role: 'root', username: 'con espacio', email: 'malo' })
        .expect(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThanOrEqual(3);
    });

    it('PUT /usuarios/:id actualiza', async () => {
      await request(app.getHttpServer())
        .put('/usuarios/1')
        .send({ ...body, username: undefined })
        .expect(200);
    });

    it('POST /usuarios/:id/restablecer-contrasena responde 200 y valida mínimo 8', async () => {
      await request(app.getHttpServer()).post('/usuarios/3/restablecer-contrasena').send({}).expect(200);
      expect(p.restablecer.execute).toHaveBeenCalledWith({ id: 3, newPassword: null });
      await request(app.getHttpServer())
        .post('/usuarios/3/restablecer-contrasena')
        .send({ newPassword: 'corta' })
        .expect(400);
    });

    it('DELETE /usuarios/:id responde 204 y 422 al eliminarse a sí mismo', async () => {
      await request(app.getHttpServer()).delete('/usuarios/9').expect(204);
      const res = await request(app.getHttpServer()).delete(`/usuarios/${adminActor.id}`).expect(422);
      expect(res.body.code).toBe('INVALID_OPERATION');
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({
        controllers: [UsuariosController],
        providers: providers().list,
        actor: funcionarioActor,
      });
    });
    afterAll(() => app.close());

    it('no puede acceder (403)', async () => {
      await request(app.getHttpServer()).get('/usuarios').expect(403);
      await request(app.getHttpServer()).post('/usuarios').send(body).expect(403);
    });
  });
});
