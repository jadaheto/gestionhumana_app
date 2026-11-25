import {
  ConflictError,
  InvalidOperationError,
  NotFoundError,
  ValidationError,
} from '../../../../../shared/domain/domain-error';
import { adminActor, FakePasswordHasher, FakeTokenGenerator } from '../../../../../shared/testing';
import {
  CreateUsuarioUseCase,
  DeleteUsuarioUseCase,
  GetUsuarioUseCase,
  ListUsuariosUseCase,
  ResetPasswordUsuarioUseCase,
  UpdateUsuarioUseCase,
} from '../usuarios.use-cases';
import { InMemoryUsuarioRepository } from './in-memory-usuarios.repositories';

describe('Casos de uso de Usuarios', () => {
  let repo: InMemoryUsuarioRepository;
  let hasher: FakePasswordHasher;
  let tokens: FakeTokenGenerator;
  let crear: CreateUsuarioUseCase;

  const base = {
    username: 'jperez',
    email: 'JPerez@comfasucre.com.co',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'funcionario',
    sedeId: 1,
    areaId: null,
    cargoId: 2,
  };

  beforeEach(() => {
    repo = new InMemoryUsuarioRepository();
    repo.sedes.set(1, 'Principal');
    repo.cargos.set(2, 'Analista');
    hasher = new FakePasswordHasher();
    tokens = new FakeTokenGenerator();
    crear = new CreateUsuarioUseCase(repo, hasher, tokens);
  });

  describe('crear', () => {
    it('crea el usuario, genera contraseña temporal, y la devuelve una sola vez', async () => {
      const dto = await crear.execute(base);
      expect(dto.id).toBe(1);
      expect(dto.email).toBe('jperez@comfasucre.com.co');
      expect(dto.temporaryPassword).toBe('Temp1234!');
      expect(repo.passwords.get(1)).toBe('hashed:Temp1234!');
      expect(dto.sedeNombre).toBe('Principal');
      expect(dto.cargoNombre).toBe('Analista');
    });

    it('usa la contraseña indicada y no devuelve temporal', async () => {
      const dto = await crear.execute({ ...base, password: 'ClaveSegura1' });
      expect(dto.temporaryPassword).toBeNull();
      expect(repo.passwords.get(1)).toBe('hashed:ClaveSegura1');
    });

    it('rechaza contraseñas indicadas de menos de 8 caracteres', async () => {
      await expect(crear.execute({ ...base, password: 'corta' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('trata un rol desconocido como funcionario', async () => {
      const dto = await crear.execute({ ...base, role: 'superuser' });
      expect(dto.role).toBe('funcionario');
    });

    it('rechaza username y correo duplicados', async () => {
      await crear.execute(base);
      await expect(crear.execute({ ...base, email: 'otro@x.com' })).rejects.toBeInstanceOf(ConflictError);
      await expect(crear.execute({ ...base, username: 'otro' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('valida datos obligatorios', async () => {
      await expect(crear.execute({ ...base, email: 'no-es-correo' })).rejects.toBeInstanceOf(ValidationError);
      await expect(crear.execute({ ...base, username: ' ' })).rejects.toBeInstanceOf(ValidationError);
      await expect(crear.execute({ ...base, firstName: '' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('listar y obtener', () => {
    it('lista ordenado por nombre con nombres de catálogos', async () => {
      await crear.execute({ ...base, username: 'zoe', email: 'zoe@x.com', firstName: 'Zoe' });
      await crear.execute({ ...base, username: 'ana', email: 'ana@x.com', firstName: 'Ana' });
      const lista = await new ListUsuariosUseCase(repo).execute();
      expect(lista.map((u) => u.firstName)).toEqual(['Ana', 'Zoe']);
      expect(lista[0].sedeNombre).toBe('Principal');
    });

    it('obtener falla si no existe', async () => {
      await expect(new GetUsuarioUseCase(repo).execute(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('actualizar', () => {
    it('actualiza datos y rol manteniendo el username', async () => {
      const creado = await crear.execute(base);
      const dto = await new UpdateUsuarioUseCase(repo).execute({
        id: creado.id,
        email: 'nuevo@x.com',
        firstName: 'Juan Carlos',
        lastName: 'Pérez',
        role: 'admin',
        sedeId: null,
        areaId: null,
        cargoId: null,
      });
      expect(dto.username).toBe('jperez');
      expect(dto.email).toBe('nuevo@x.com');
      expect(dto.role).toBe('admin');
      expect(dto.sedeNombre).toBeNull();
    });

    it('marca a un administrador como colaborador y la descarta para un funcionario', async () => {
      const creado = await crear.execute({ ...base, role: 'admin', esColaborador: true });
      expect(creado.esColaborador).toBe(true);
      const dto = await new UpdateUsuarioUseCase(repo).execute({
        id: creado.id,
        email: base.email,
        firstName: 'Juan',
        lastName: 'Pérez',
        role: 'funcionario',
        esColaborador: true,
        sedeId: null,
        areaId: null,
        cargoId: null,
      });
      expect(dto.esColaborador).toBe(false);
    });

    it('rechaza correo usado por otro usuario y usuario inexistente', async () => {
      const a = await crear.execute(base);
      await crear.execute({ ...base, username: 'otro', email: 'otro@x.com' });
      const update = new UpdateUsuarioUseCase(repo);
      await expect(update.execute({ ...base, id: a.id, email: 'otro@x.com' })).rejects.toBeInstanceOf(ConflictError);
      await expect(update.execute({ ...base, id: 99 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('restablecer contraseña', () => {
    it('genera una temporal cuando no se indica', async () => {
      const creado = await crear.execute(base);
      const res = await new ResetPasswordUsuarioUseCase(repo, hasher, tokens).execute({ id: creado.id });
      expect(res.temporaryPassword).toBe('Temp1234!');
      expect(repo.passwords.get(creado.id)).toBe('hashed:Temp1234!');
    });

    it('usa la indicada si tiene al menos 8 caracteres', async () => {
      const creado = await crear.execute(base);
      const uc = new ResetPasswordUsuarioUseCase(repo, hasher, tokens);
      await expect(uc.execute({ id: creado.id, newPassword: '1234567' })).rejects.toBeInstanceOf(ValidationError);
      const res = await uc.execute({ id: creado.id, newPassword: '  NuevaClave99 ' });
      expect(res.temporaryPassword).toBeNull();
      expect(repo.passwords.get(creado.id)).toBe('hashed:NuevaClave99');
    });

    it('falla con usuario inexistente', async () => {
      await expect(new ResetPasswordUsuarioUseCase(repo, hasher, tokens).execute({ id: 7 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('eliminar', () => {
    it('elimina a otro usuario pero nunca a sí mismo', async () => {
      const creado = await crear.execute(base);
      const uc = new DeleteUsuarioUseCase(repo);
      await expect(uc.execute({ id: adminActor.id, actor: adminActor })).rejects.toBeInstanceOf(InvalidOperationError);
      await uc.execute({ id: creado.id, actor: { ...adminActor, id: 50 } });
      expect(repo.items).toHaveLength(0);
      await expect(uc.execute({ id: creado.id, actor: { ...adminActor, id: 50 } })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
