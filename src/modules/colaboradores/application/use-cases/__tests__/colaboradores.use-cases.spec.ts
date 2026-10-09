import {
  ConflictError,
  InvalidOperationError,
  NotFoundError,
  ValidationError,
} from '../../../../../shared/domain/domain-error';
import { adminActor, FakePasswordHasher, FakeTokenGenerator, InMemoryFileStorage } from '../../../../../shared/testing';
import {
  CreateColaboradorUseCase,
  DeleteColaboradorUseCase,
  GetColaboradorUseCase,
  ListColaboradoresUseCase,
  UpdateColaboradorUseCase,
  UploadFotoColaboradorUseCase,
} from '../colaboradores.use-cases';
import {
  colaboradorBase,
  FakeContratoActivoReader,
  FakePuntosInitializer,
  InMemoryColaboradorRepository,
} from './in-memory-colaboradores.repositories';

const input = {
  firstName: 'Ana María',
  lastName: 'Gómez Díaz',
  email: 'agomez@comfasucre.com.co',
  cedula: '2002',
  codigoEmpresa: 'COMF-002',
  phoneNumber: null,
  telefono: null,
  celular: null,
  sedeId: 1,
  areaId: null,
  cargoId: null,
  estadoColaborador: 'activo',
  fechaNacimiento: null,
  fechaIngreso: '2025-02-01',
  genero: null,
  estadoCivil: null,
  direccion: null,
  eps: null,
  arl: null,
  fondoPension: null,
  cajaCompensacion: null,
  tipoSangre: null,
  designation: null,
};

describe('Casos de uso de Colaboradores', () => {
  let repo: InMemoryColaboradorRepository;
  let puntos: FakePuntosInitializer;
  let create: CreateColaboradorUseCase;

  beforeEach(() => {
    repo = new InMemoryColaboradorRepository();
    puntos = new FakePuntosInitializer();
    create = new CreateColaboradorUseCase(repo, new FakePasswordHasher(), new FakeTokenGenerator(), puntos);
  });

  describe('crear', () => {
    it('genera usuario (inicial + apellido) y contraseña temporal, y crea la fila de puntos', async () => {
      const res = await create.execute(input);
      expect(res.username).toBe('agomezdiaz');
      expect(res.temporaryPassword).toBe('Temp1234!');
      expect(repo.passwords.get(res.colaborador.id)).toBe('hashed:Temp1234!');
      expect(repo.items[0].props.role).toBe('funcionario');
      expect(puntos.initialized).toEqual([res.colaborador.id]);
    });

    it('añade un contador cuando el usuario generado ya existe', async () => {
      repo.seed(colaboradorBase({ username: 'agomezdiaz', email: 'otro@x.com', cedula: '9', codigoEmpresa: null }));
      const res = await create.execute(input);
      expect(res.username).toBe('agomezdiaz1');
    });

    it('usa la contraseña y el usuario indicados sin devolver contraseña temporal', async () => {
      const res = await create.execute({ ...input, username: 'Ana.Gomez', password: 'MiClave2024' });
      expect(res.username).toBe('ana.gomez');
      expect(res.temporaryPassword).toBeNull();
      expect(repo.passwords.get(res.colaborador.id)).toBe('hashed:MiClave2024');
    });

    it('rechaza usuario, correo, cédula y código de empresa duplicados', async () => {
      repo.seed(colaboradorBase());
      await expect(create.execute({ ...input, email: 'JPEREZ@comfasucre.com.co' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      await expect(create.execute({ ...input, cedula: '1001' })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute({ ...input, codigoEmpresa: 'COMF-001' })).rejects.toBeInstanceOf(ConflictError);
      await expect(create.execute({ ...input, username: 'jperez' })).rejects.toBeInstanceOf(ConflictError);
      expect(repo.items).toHaveLength(1);
    });

    it('valida campos obligatorios y formatos', async () => {
      await expect(create.execute({ ...input, email: '' })).rejects.toThrow('El correo electrónico es obligatorio.');
      await expect(create.execute({ ...input, cedula: ' ' })).rejects.toThrow('La cédula es obligatoria.');
      await expect(create.execute({ ...input, fechaIngreso: '15/01/2024' })).rejects.toBeInstanceOf(ValidationError);
      await expect(create.execute({ ...input, estadoColaborador: 'raro' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('listar y consultar', () => {
    it('excluye administradores y filtra por estado, área y sede', async () => {
      repo.seed(
        colaboradorBase({ username: 'admin', role: 'admin', email: 'admin@x.com', cedula: '1', codigoEmpresa: null }),
      );
      repo.seed(
        colaboradorBase({
          username: 'a',
          email: 'a@x.com',
          cedula: '2',
          codigoEmpresa: null,
          estadoColaborador: 'inactivo',
          areaId: 5,
        }),
      );
      repo.seed(colaboradorBase({ username: 'b', email: 'b@x.com', cedula: '3', codigoEmpresa: null, sedeId: 9 }));
      const list = new ListColaboradoresUseCase(repo);
      expect(await list.execute({})).toHaveLength(2);
      expect((await list.execute({ estado: 'inactivo' })).map((c) => c.username)).toEqual(['a']);
      expect((await list.execute({ areaId: 5 })).map((c) => c.username)).toEqual(['a']);
      expect((await list.execute({ sedeId: 9 })).map((c) => c.username)).toEqual(['b']);
    });

    it('devuelve el detalle con nombres y contrato activo', async () => {
      const c = repo.seed(colaboradorBase());
      repo.nombres[c.id as number] = { sedeNombre: 'Principal', cargoNombre: 'Analista', cargoFunciones: 'Analizar' };
      const contratos = new FakeContratoActivoReader();
      contratos.contratos.set(c.id as number, {
        id: 7,
        tipoContrato: 'fijo',
        numeroContrato: 'C-1',
        fechaInicio: '2024-01-15',
        fechaFin: null,
        salarioBase: 2500000,
        estado: 'activo',
      });
      const detalle = await new GetColaboradorUseCase(repo, contratos).execute(c.id as number);
      expect(detalle.sedeNombre).toBe('Principal');
      expect(detalle.cargoFunciones).toBe('Analizar');
      expect(detalle.contratoActivo?.numeroContrato).toBe('C-1');
      expect(detalle.fullName).toBe('Juan Pérez');
      await expect(new GetColaboradorUseCase(repo, contratos).execute(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('actualizar', () => {
    it('conserva usuario, rol y foto, y valida duplicados excluyéndose a sí mismo', async () => {
      const c = repo.seed(colaboradorBase({ profileImage: 'profile/a.png' }));
      const update = new UpdateColaboradorUseCase(repo);
      const res = await update.execute({
        ...input,
        id: c.id as number,
        email: 'jperez@comfasucre.com.co',
        cedula: '1001',
        codigoEmpresa: 'COMF-001',
      });
      expect(res.firstName).toBe('Ana María');
      expect(res.username).toBe('jperez');
      expect(res.profileImage).toBe('profile/a.png');
      repo.seed(colaboradorBase({ username: 'x', email: 'x@x.com', cedula: '555', codigoEmpresa: null }));
      await expect(update.execute({ ...input, id: c.id as number, cedula: '555' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      await expect(update.execute({ ...input, id: 404 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('foto y eliminación', () => {
    it('guarda la foto en la carpeta profile y la asocia al colaborador', async () => {
      const c = repo.seed(colaboradorBase());
      const storage = new InMemoryFileStorage();
      const res = await new UploadFotoColaboradorUseCase(repo, storage).execute({
        id: c.id as number,
        content: Buffer.from('img'),
        originalName: 'foto.PNG',
        mimeType: 'image/png',
      });
      expect(res.profileImage).toBe('profile/file-1.png');
      await expect(
        new UploadFotoColaboradorUseCase(repo, storage).execute({
          id: c.id as number,
          content: Buffer.from('x'),
          originalName: 'doc.pdf',
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow();
    });

    it('no permite que el administrador se elimine a sí mismo', async () => {
      const c = repo.seed(colaboradorBase({ id: 10 }));
      const del = new DeleteColaboradorUseCase(repo);
      await expect(del.execute({ actor: adminActor, id: adminActor.id })).rejects.toBeInstanceOf(InvalidOperationError);
      await del.execute({ actor: adminActor, id: c.id as number });
      expect(repo.items).toHaveLength(0);
      await expect(del.execute({ actor: adminActor, id: c.id as number })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
