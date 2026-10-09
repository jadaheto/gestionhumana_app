import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { aniosCumplidos, diasEntre, diasHabilesAproximados } from '../../../domain/calculos-fecha';
import { GetDashboardUseCase } from '../get-dashboard.use-case';
import { FakeDashboardQueries } from './fake-dashboard-queries';

describe('Cálculos de fecha del dashboard', () => {
  it('cuenta años cumplidos respetando el día del aniversario', () => {
    expect(aniosCumplidos('2020-10-08', '2026-10-08')).toBe(6);
    expect(aniosCumplidos('2020-10-09', '2026-10-08')).toBe(5);
    expect(aniosCumplidos('2027-01-01', '2026-10-08')).toBe(0);
  });

  it('cuenta días calendario y días hábiles (lunes a viernes)', () => {
    expect(diasEntre('2026-10-01', '2026-10-08')).toBe(7);
    // Lunes 5 a domingo 11 de octubre de 2026 → 5 días hábiles
    expect(diasHabilesAproximados('2026-10-05', '2026-10-11')).toBe(5);
    expect(diasHabilesAproximados('2026-10-11', '2026-10-05')).toBe(0);
  });
});

describe('GetDashboardUseCase', () => {
  let queries: FakeDashboardQueries;
  let useCase: GetDashboardUseCase;
  const clock = new FakeClock(new Date('2026-10-08T10:00:00.000Z'));

  beforeEach(() => {
    queries = new FakeDashboardQueries();
    useCase = new GetDashboardUseCase(queries, clock);
  });

  it('para el administrador devuelve estadísticas, contratos con días restantes y distribuciones', async () => {
    queries.colaboradores = { total: 10, activo: 8, inactivo: 2 };
    queries.permisosPendientes = 3;
    queries.contratos = [
      {
        id: 1,
        userId: 5,
        nombre: 'Ana Ruiz',
        profileImage: null,
        tipoContrato: 'fijo',
        numeroContrato: 'C-1',
        fechaFin: '2026-10-15',
      },
      {
        id: 2,
        userId: 6,
        nombre: 'Luis Mora',
        profileImage: null,
        tipoContrato: 'obra_labor',
        numeroContrato: 'C-2',
        fechaFin: '2026-10-08',
      },
    ];
    queries.porArea = [{ nombre: 'TI', total: 4 }];
    queries.cumpleaneros = [
      { id: 9, nombre: 'Eva', profileImage: null, cargoNombre: null, areaNombre: null, fechaNacimiento: '1990-10-08' },
    ];

    const r = await useCase.execute(adminActor);
    expect(r.rol).toBe('admin');
    if (r.rol !== 'admin') return;
    expect(r.estadisticas).toEqual({ totalColaboradores: 10, activos: 8, inactivos: 2, permisosPendientes: 3 });
    expect(r.contratosPorVencer.map((c) => c.diasRestantes)).toEqual([7, 0]);
    expect(r.porArea).toEqual([{ nombre: 'TI', total: 4 }]);
    expect(r.cumpleaneros).toHaveLength(1);
    expect(queries.llamadas).toContain('contratosPorVencer:2026-10-08:30');
    expect(queries.llamadas).not.toContain('perfilUsuario');
  });

  it('para el funcionario calcula días en la empresa y saldo de vacaciones', async () => {
    queries.perfil = {
      id: 2,
      nombre: 'Juan Pérez',
      profileImage: null,
      cargoNombre: 'Analista',
      areaNombre: 'TI',
      fechaIngreso: '2023-10-01',
    };
    queries.misPermisos = { total: 4, pendiente: 1 };
    // Vacaciones del lunes 2 al viernes 13 de marzo de 2026 → 10 días hábiles, suspendida tras 6 días disfrutados.
    queries.vacaciones = [
      { permisoId: 1, fechaInicio: '2026-03-02', fechaFin: '2026-03-13', diasDisfrutadosSuspension: 6 },
    ];

    const r = await useCase.execute(funcionarioActor);
    expect(r.rol).toBe('funcionario');
    if (r.rol !== 'funcionario') return;
    expect(r.perfil.cargoNombre).toBe('Analista');
    expect(r.diasEnEmpresa).toBe(diasEntre('2023-10-01', '2026-10-08'));
    expect(r.vacaciones).toEqual({ periodos: 3, diasAcumulados: 45, diasConsumidos: 6, diasPendientes: 39 });
    expect(r.permisos).toEqual({ total: 4, pendientes: 1 });
    expect(queries.llamadas).not.toContain('countColaboradores:todos');
  });

  it('un funcionario sin fecha de ingreso tiene 0 días y 0 períodos', async () => {
    queries.perfil = {
      id: 2,
      nombre: 'Juan',
      profileImage: null,
      cargoNombre: null,
      areaNombre: null,
      fechaIngreso: null,
    };
    const r = await useCase.execute(funcionarioActor);
    if (r.rol !== 'funcionario') throw new Error('rol inesperado');
    expect(r.diasEnEmpresa).toBe(0);
    expect(r.vacaciones.diasPendientes).toBe(0);
  });
});
