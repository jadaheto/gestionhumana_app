import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock } from '../../../../../shared/testing';
import {
  BuscarColaboradorUseCase,
  CrearSolicitudUseCase,
  GenerarNumeroSolicitudUseCase,
  GetSalarioReferenciaUseCase,
  GetSolicitudUseCase,
  ListSolicitudesUseCase,
} from '../endeudamiento.use-cases';
import {
  InMemoryColaboradorFinder,
  InMemoryEndeudamientoRepository,
  InMemorySalarioReferenciaReader,
} from './in-memory-endeudamiento.repositories';

function setup() {
  const clock = new FakeClock(new Date('2026-10-08T15:00:00'));
  const repo = new InMemoryEndeudamientoRepository();
  const finder = new InMemoryColaboradorFinder();
  const salarios = new InMemorySalarioReferenciaReader();
  const ana = { id: 10, firstName: 'Ana', lastName: 'Pérez', cedula: '111', codigoEmpresa: 'E-10' };
  const luis = { id: 11, firstName: 'Luis', lastName: 'Gómez', cedula: '222', codigoEmpresa: null };
  finder.items = [ana, luis];
  repo.colaboradores.set(10, ana);
  repo.colaboradores.set(11, luis);
  salarios.salarios.set(10, 2_500_000);
  const numerador = new GenerarNumeroSolicitudUseCase(repo, clock);
  return {
    clock,
    repo,
    finder,
    salarios,
    numerador,
    crear: new CrearSolicitudUseCase(repo, finder, numerador, clock),
    listar: new ListSolicitudesUseCase(repo),
    ver: new GetSolicitudUseCase(repo),
    buscar: new BuscarColaboradorUseCase(finder, salarios),
    salario: new GetSalarioReferenciaUseCase(finder, salarios),
  };
}

const entrada = {
  userId: 10,
  fecha: '2026-10-08',
  salarioMensual: 2_500_000,
  otrosDevengados: 0,
  deduccionesLey: 200_000,
  umbralAprobacion: 50,
  conceptos: [
    { concepto: 'SALUD', devengado: 0, deducido: 100_000 },
    { concepto: 'PENSION', devengado: 0, deducido: 100_000 },
    { concepto: '', devengado: 0, deducido: 0 },
  ],
  valorSolicitado: 12_000_000,
  plazoMeses: 24,
  cuotaMensual: 500_000,
  opcionCredito: 'A',
};

describe('CrearSolicitudUseCase', () => {
  it('genera el número de solicitud cuando no se indica, calcula y guarda con el actor como creador', async () => {
    const s = setup();
    const r = await s.crear.execute({ ...entrada, actor: adminActor });
    expect(r.solicitudNo).toBe('SOL-2026-0001');
    expect(r).toMatchObject({
      colaborador: 'Ana Pérez',
      cedula: '111',
      totalDevengado: 2_500_000,
      totalDeducido: 200_000,
      porcentajeActual: 8,
      porcentajeNuevoCredito: 28,
      valorQuincenal: 250_000,
      netoRecibir: 1_800_000,
      deduccionesEndeudamiento: 0,
      estado: 'aprobado',
      conclusion: 'APROBADO',
      anio: 2026,
    });
    expect(r.conceptos.map((c) => c.concepto)).toEqual(['SALUD', 'PENSION']);
    expect(r.conceptos[0]).toMatchObject({ porcentaje: 4, orden: 1 });
    expect(s.repo.items[0].createdBy).toBe(adminActor.id);
    expect(s.repo.items[0].createdAt).toEqual(s.clock.now());
  });

  it('respeta el número indicado, rechaza por umbral y usa la conclusión manual', async () => {
    const s = setup();
    const r = await s.crear.execute({
      ...entrada,
      solicitudNo: 'SOL-MANUAL-1',
      cuotaMensual: 1_200_000,
      umbralAprobacion: 40,
      conclusion: 'revisar con comité',
      actor: adminActor,
    });
    expect(r.solicitudNo).toBe('SOL-MANUAL-1');
    expect(r.porcentajeNuevoCredito).toBe(56);
    expect(r.estado).toBe('rechazado');
    expect(r.conclusion).toBe('REVISAR CON COMITÉ');
  });

  it('el consecutivo avanza por año', async () => {
    const s = setup();
    await s.crear.execute({ ...entrada, actor: adminActor });
    await s.crear.execute({ ...entrada, actor: adminActor });
    expect((await s.numerador.execute()).solicitudNo).toBe('SOL-2026-0003');
    expect((await s.numerador.execute({ anio: 2025 })).solicitudNo).toBe('SOL-2025-0001');
  });

  it('falla si el colaborador no existe o faltan datos obligatorios', async () => {
    const s = setup();
    await expect(s.crear.execute({ ...entrada, userId: 99, actor: adminActor })).rejects.toThrow(NotFoundError);
    await expect(s.crear.execute({ ...entrada, userId: 0, actor: adminActor })).rejects.toThrow(ValidationError);
    await expect(s.crear.execute({ ...entrada, fecha: '', actor: adminActor })).rejects.toThrow(
      'Debes seleccionar colaborador, fecha y número de solicitud.',
    );
  });
});

describe('Listar y ver solicitudes', () => {
  it('lista de más reciente a más antigua y muestra el detalle con conceptos', async () => {
    const s = setup();
    const primera = await s.crear.execute({ ...entrada, actor: adminActor });
    s.clock.advanceMinutes(5);
    const segunda = await s.crear.execute({ ...entrada, userId: 11, actor: adminActor });
    const lista = await s.listar.execute();
    expect(lista.map((x) => x.id)).toEqual([segunda.id, primera.id]);
    expect(lista[0]).toMatchObject({ colaborador: 'Luis Gómez', solicitudNo: 'SOL-2026-0002', estado: 'aprobado' });

    const detalle = await s.ver.execute(primera.id);
    expect(detalle.conceptos).toHaveLength(2);
    await expect(s.ver.execute(999)).rejects.toThrow(NotFoundError);
  });
});

describe('Búsqueda de colaboradores y salario de referencia', () => {
  it('busca por nombre, cédula o código e incluye el salario de referencia', async () => {
    const s = setup();
    expect(await s.buscar.execute({ q: 'ana' })).toEqual([
      { id: 10, nombre: 'Ana Pérez', cedula: '111', codigo: 'E-10', salario: 2_500_000 },
    ]);
    expect((await s.buscar.execute({ q: '222' }))[0]).toMatchObject({ id: 11, salario: 0 });
    expect(await s.buscar.execute({})).toHaveLength(2);
  });

  it('devuelve el salario de referencia de un colaborador existente', async () => {
    const s = setup();
    expect(await s.salario.execute(10)).toEqual({ userId: 10, salario: 2_500_000 });
    await expect(s.salario.execute(99)).rejects.toThrow(NotFoundError);
  });
});
