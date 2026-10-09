import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor, InMemoryFileStorage } from '../../../../../shared/testing';
import { DiasHabilesCalculator } from '../../../domain/dias-habiles.calculator';
import { Permiso } from '../../../domain/permiso';
import { VacacionesSaldoCalculator } from '../../../domain/vacaciones-saldo';
import { VacacionesSuspension } from '../../../domain/vacaciones-suspension';
import {
  ListarColaboradoresUseCase,
  ListarIncapacidadesUseCase,
  RegistrarIncapacidadUseCase,
} from '../incapacidades.use-cases';
import { GetResumenVacacionesUseCase, ListarVacacionesUseCase } from '../vacaciones.use-cases';
import {
  FakeUsuariosPort,
  InMemoryIncapacidadRepository,
  InMemoryPermisoRepository,
  InMemorySuspensionRepository,
  InMemoryVacacionRepository,
} from './in-memory-beneficios.repositories';

const calculadora = new DiasHabilesCalculator();
const AHORA = '2026-10-08 10:00:00';

describe('GetResumenVacacionesUseCase', () => {
  let permisos: InMemoryPermisoRepository;
  let suspensiones: InMemorySuspensionRepository;
  let usuarios: FakeUsuariosPort;
  let useCase: GetResumenVacacionesUseCase;

  beforeEach(() => {
    permisos = new InMemoryPermisoRepository();
    suspensiones = new InMemorySuspensionRepository();
    usuarios = new FakeUsuariosPort();
    useCase = new GetResumenVacacionesUseCase(
      permisos,
      suspensiones,
      usuarios,
      new FakeClock(new Date('2026-10-08T10:00:00')),
      calculadora,
      new VacacionesSaldoCalculator(calculadora),
    );
  });

  async function sembrar(): Promise<void> {
    usuarios.fechasIngreso.set(2, '2023-03-01'); // 3 períodos → 45 días
    const aprobada = await permisos.save(
      Permiso.create({
        userId: 2,
        tipoPermiso: 'vacaciones',
        fechaInicio: '2026-02-02',
        fechaFin: '2026-02-13',
        justificacion: 'x',
      }).aprobar(1, null, AHORA),
    ); // 10 días
    await permisos.save(
      Permiso.create({
        userId: 2,
        tipoPermiso: 'vacaciones',
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-04',
        justificacion: 'x',
      }),
    ); // pendiente
    await permisos.save(
      Permiso.create({
        userId: 2,
        tipoPermiso: 'personal',
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-01',
        justificacion: 'x',
      }),
    );
    await suspensiones.save(
      VacacionesSuspension.registrar({
        permiso: aprobada,
        diasDisfrutados: 4,
        motivo: 'Urgencia',
        adminId: 1,
        ahora: AHORA,
        calculadora,
      }),
    );
    suspensiones.rangos.set(aprobada.id!, { fechaInicio: '2026-02-02 00:00:00', fechaFin: '2026-02-13 00:00:00' });
  }

  it('devuelve saldo, fecha de referencia, solicitudes de vacaciones y suspensiones del propio usuario', async () => {
    await sembrar();
    const r = await useCase.execute({ actor: funcionarioActor });
    expect(r.userId).toBe(2);
    expect(r.fechaReferencia).toBe('2023-03-01');
    expect(r.saldo).toEqual({ periodos: 3, diasAcumulados: 45, diasConsumidos: 4, diasPendientes: 41 });
    expect(r.solicitudes).toHaveLength(2); // sólo tipo vacaciones
    expect(r.solicitudes.map((s) => s.diasHabiles).sort((a, b) => a - b)).toEqual([4, 10]);
    expect(r.suspensiones).toHaveLength(1);
    expect(r.suspensiones[0]).toMatchObject({
      diasTotales: 10,
      diasDisfrutados: 4,
      diasReintegrados: 6,
      fechaInicio: '2026-02-02 00:00:00',
    });
  });

  it('el administrador puede consultar a otro usuario; el funcionario no', async () => {
    await sembrar();
    const r = await useCase.execute({ actor: adminActor, userId: 2 });
    expect(r.saldo.diasPendientes).toBe(41);
    await expect(useCase.execute({ actor: funcionarioActor, userId: 1 })).rejects.toThrow(ForbiddenError);
  });

  it('falla si el usuario consultado no existe', async () => {
    await expect(useCase.execute({ actor: adminActor, userId: 99 })).rejects.toThrow(NotFoundError);
  });

  it('sin fecha de referencia el saldo es cero', async () => {
    const r = await useCase.execute({ actor: funcionarioActor });
    expect(r.fechaReferencia).toBeNull();
    expect(r.saldo).toEqual({ periodos: 0, diasAcumulados: 0, diasConsumidos: 0, diasPendientes: 0 });
  });
});

describe('ListarVacacionesUseCase', () => {
  it('admin ve todos los períodos con colaborador; funcionario sólo los suyos', async () => {
    const repo = new InMemoryVacacionRepository();
    repo.items = [
      {
        id: 1,
        userId: 2,
        periodo: '2025-2026',
        diasTotales: 15,
        diasTomados: 5,
        diasPendientes: 10,
        estado: 'activo',
        createdAt: null,
      },
      {
        id: 2,
        userId: 3,
        periodo: '2025-2026',
        diasTotales: 15,
        diasTomados: 0,
        diasPendientes: 15,
        estado: 'activo',
        createdAt: null,
      },
    ];
    const useCase = new ListarVacacionesUseCase(repo);
    const admin = await useCase.execute(adminActor);
    expect(admin).toHaveLength(2);
    expect(admin[0].colaborador).toBe('Usuario 2');
    const propias = await useCase.execute(funcionarioActor);
    expect(propias).toHaveLength(1);
    expect(propias[0].colaborador).toBeNull();
  });
});

describe('Incapacidades', () => {
  let repo: InMemoryIncapacidadRepository;
  let usuarios: FakeUsuariosPort;
  let files: InMemoryFileStorage;
  let registrar: RegistrarIncapacidadUseCase;
  let listar: ListarIncapacidadesUseCase;

  beforeEach(() => {
    repo = new InMemoryIncapacidadRepository();
    usuarios = new FakeUsuariosPort();
    files = new InMemoryFileStorage();
    registrar = new RegistrarIncapacidadUseCase(repo, usuarios, files);
    listar = new ListarIncapacidadesUseCase(repo);
  });

  const base = { tipo: 'enfermedad_general', fechaInicio: '2026-10-01', fechaFin: '2026-10-03', dias: 3 };

  it('el administrador registra sobre el colaborador indicado y guarda el soporte en "incapacidades"', async () => {
    usuarios.existentes.add(5);
    const dto = await registrar.execute({
      actor: adminActor,
      userId: 5,
      ...base,
      entidadEmisora: 'EPS Sura',
      numeroIncapacidad: 'INC-001',
      archivo: { buffer: Buffer.from('img'), originalName: 'soporte.PNG', mimeType: 'image/png' },
    });
    expect(dto.userId).toBe(5);
    expect(dto.archivoSoporte).toBe('incapacidades/file-1.png');
    expect(dto.estado).toBe('activo');
    expect(dto.entidadEmisora).toBe('EPS Sura');
  });

  it('el funcionario siempre registra sobre sí mismo aunque envíe otro userId', async () => {
    const dto = await registrar.execute({ actor: funcionarioActor, userId: 5, ...base });
    expect(dto.userId).toBe(funcionarioActor.id);
  });

  it('calcula los días si no se indican y valida fechas y tipo', async () => {
    const dto = await registrar.execute({ actor: funcionarioActor, ...base, dias: null });
    expect(dto.dias).toBe(3);
    await expect(registrar.execute({ actor: funcionarioActor, ...base, fechaFin: '2026-09-01' })).rejects.toThrow(
      ValidationError,
    );
    await expect(registrar.execute({ actor: funcionarioActor, ...base, tipo: 'vacaciones' })).rejects.toThrow(
      'Tipo de incapacidad inválido.',
    );
  });

  it('el administrador no puede registrar sobre un colaborador inexistente', async () => {
    await expect(registrar.execute({ actor: adminActor, userId: 404, ...base })).rejects.toThrow(NotFoundError);
  });

  it('rechaza soportes .docx (no permitidos en incapacidades)', async () => {
    await expect(
      registrar.execute({
        actor: adminActor,
        ...base,
        archivo: { buffer: Buffer.from('x'), originalName: 'a.docx', mimeType: 'application/msword' },
      }),
    ).rejects.toThrow('Extensión no permitida');
  });

  it('lista todas para admin y sólo propias para funcionario', async () => {
    await registrar.execute({ actor: funcionarioActor, ...base });
    usuarios.existentes.add(5);
    await registrar.execute({ actor: adminActor, userId: 5, ...base });
    expect(await listar.execute(adminActor)).toHaveLength(2);
    const propias = await listar.execute(funcionarioActor);
    expect(propias).toHaveLength(1);
    expect(propias[0].userId).toBe(2);
  });
});

describe('ListarColaboradoresUseCase', () => {
  it('devuelve los colaboradores del puerto de usuarios', async () => {
    const usuarios = new FakeUsuariosPort();
    usuarios.colaboradores = [{ id: 2, nombre: 'Juan Pérez', cedula: '123' }];
    expect(await new ListarColaboradoresUseCase(usuarios).execute()).toEqual([
      { id: 2, nombre: 'Juan Pérez', cedula: '123' },
    ]);
  });
});
