import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { Contrato } from '../../../domain/contrato';
import {
  EliminarContratoUseCase,
  GuardarContratoUseCase,
  ListarColaboradoresUseCase,
  ListarContratosUseCase,
  ListarProrrogasUseCase,
  ObtenerContratoUseCase,
  RegistrarProrrogaUseCase,
} from '../contratos.use-cases';
import { NotificarContratosPorVencerUseCase } from '../notificar-contratos-por-vencer.use-case';
import { SincronizarContratosVencidosUseCase } from '../sincronizar-contratos-vencidos.use-case';
import {
  InMemoryContratoAlertaRepository,
  InMemoryContratoProrrogaRepository,
  InMemoryContratoRepository,
  InMemoryNotificaciones,
  InMemoryUsuarios,
} from './in-memory-contratos.repositories';

function contexto() {
  const clock = new FakeClock(new Date('2026-10-08T15:00:00.000Z'));
  const usuarios = new InMemoryUsuarios();
  usuarios.items = [
    { id: 1, firstName: 'Administrador', lastName: 'Sistema', cedula: '1', role: 'admin', estadoColaborador: 'activo' },
    {
      id: 2,
      firstName: 'Juan',
      lastName: 'Pérez',
      cedula: '123',
      role: 'funcionario',
      estadoColaborador: 'activo',
      cargoNombre: 'Analista',
      areaNombre: 'TI',
    },
    { id: 3, firstName: 'Ana', lastName: 'Gómez', cedula: '456', role: 'funcionario', estadoColaborador: 'activo' },
    {
      id: 4,
      firstName: 'Luis',
      lastName: 'Retirado',
      cedula: '789',
      role: 'funcionario',
      estadoColaborador: 'retirado',
    },
  ];
  const contratos = new InMemoryContratoRepository(usuarios);
  const prorrogas = new InMemoryContratoProrrogaRepository(contratos);
  const alertas = new InMemoryContratoAlertaRepository();
  const notificaciones = new InMemoryNotificaciones();
  const sincronizar = new SincronizarContratosVencidosUseCase(contratos, usuarios, clock);
  const notificar = new NotificarContratosPorVencerUseCase(contratos, alertas, usuarios, notificaciones, clock);
  return { clock, usuarios, contratos, prorrogas, alertas, notificaciones, sincronizar, notificar };
}

function contrato(
  userId: number,
  fechaFin: string | null,
  extra: Partial<Parameters<typeof Contrato.create>[0]> = {},
): Contrato {
  return Contrato.create({
    userId,
    tipoContrato: 'fijo',
    numeroContrato: `CT-${userId}`,
    fechaInicio: '2026-01-01',
    fechaFin,
    salarioBase: 2_000_000,
    ...extra,
  });
}

describe('Sincronización de contratos vencidos', () => {
  it('finaliza los activos con fecha fin pasada y actualiza estado_colaborador', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-07')); // vencido ayer
    await ctx.contratos.save(contrato(3, '2026-10-08')); // vence hoy: sigue activo
    await ctx.contratos.save(contrato(4, '2026-01-31')); // retirado: no se toca su estado

    const n = await ctx.sincronizar.execute({ forzar: true });

    expect(n).toBe(2);
    expect(ctx.contratos.items.map((c) => c.props.estado)).toEqual(['finalizado', 'activo', 'finalizado']);
    expect(ctx.usuarios.items.find((u) => u.id === 2)?.estadoColaborador).toBe('inactivo');
    expect(ctx.usuarios.items.find((u) => u.id === 3)?.estadoColaborador).toBe('activo');
    expect(ctx.usuarios.items.find((u) => u.id === 4)?.estadoColaborador).toBe('retirado');
    expect(ctx.usuarios.items.find((u) => u.id === 1)?.estadoColaborador).toBe('activo');
  });

  it('la variante diaria solo se ejecuta una vez por fecha', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-01'));
    expect(await ctx.sincronizar.execute({ forzar: false })).toBe(1);
    await ctx.contratos.save(contrato(3, '2026-10-02'));
    expect(await ctx.sincronizar.execute({ forzar: false })).toBe(0);
    ctx.clock.set('2026-10-09T10:00:00.000Z');
    expect(await ctx.sincronizar.execute({ forzar: false })).toBe(1);
  });
});

describe('Alertas de contratos por vencer', () => {
  it('notifica a cada admin activo una sola vez por contrato y fecha fin', async () => {
    const ctx = contexto();
    ctx.usuarios.items.push({
      id: 5,
      firstName: 'Admin',
      lastName: 'Dos',
      cedula: null,
      role: 'admin',
      estadoColaborador: 'inactivo',
    });
    await ctx.contratos.save(contrato(2, '2026-10-15')); // en 7 días
    await ctx.contratos.save(contrato(3, '2026-12-31')); // fuera de la ventana de 30 días
    await ctx.contratos.save(contrato(3, '2026-10-20', { estado: 'finalizado' })); // no activo

    expect(await ctx.notificar.execute()).toBe(1);
    expect(ctx.notificaciones.items).toEqual([
      {
        userId: 1,
        titulo: 'Contrato por vencer',
        mensaje: 'Juan Pérez vence en 7 día(s). Define si deseas prorrogarlo.',
        tipo: 'contrato',
        link: '/contratos',
      },
    ]);
    expect(ctx.alertas.items).toEqual([
      { contratoId: 1, destinatarioId: 1, alertaTipo: 'vencimiento', alertaFecha: '2026-10-15' },
    ]);

    // Segunda carga: no se repite
    expect(await ctx.notificar.execute()).toBe(0);
    expect(ctx.notificaciones.items).toHaveLength(1);
  });

  it('vuelve a avisar cuando cambia la fecha fin (prórroga) y no hace nada sin admins activos', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-20'));
    await ctx.notificar.execute();
    ctx.contratos.items[0] = ctx.contratos.items[0].prorrogar(1).contrato; // nueva fecha fin 2026-11-20
    ctx.clock.set('2026-11-01T10:00:00.000Z');
    expect(await ctx.notificar.execute()).toBe(1);
    expect(ctx.notificaciones.items[1].mensaje).toContain('vence en 19 día(s)');

    ctx.usuarios.items[0].estadoColaborador = 'inactivo';
    await ctx.contratos.save(contrato(3, '2026-11-05'));
    expect(await ctx.notificar.execute()).toBe(0);
  });
});

describe('Listar y obtener contratos (autorización)', () => {
  it('el admin ve todos con datos del colaborador y dispara alertas; el funcionario solo los suyos', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-20'));
    await ctx.contratos.save(contrato(3, null, { tipoContrato: 'indefinido', fechaInicio: '2026-03-01' }));
    const listar = new ListarContratosUseCase(ctx.contratos, ctx.sincronizar, ctx.notificar, ctx.clock);

    const todos = await listar.execute({ actor: adminActor });
    expect(todos.map((c) => c.colaboradorNombre)).toEqual(['Ana Gómez', 'Juan Pérez']);
    expect(todos[1]).toMatchObject({
      cedula: '123',
      cargoNombre: 'Analista',
      diasParaVencer: 12,
      puedeProrrogar: true,
      tipoContratoNombre: 'Fijo',
      estadoNombre: 'Activo',
    });
    expect(todos[0]).toMatchObject({ diasParaVencer: null, puedeProrrogar: false, fechaFin: null });
    expect(ctx.notificaciones.items).toHaveLength(1);

    const propios = await listar.execute({ actor: funcionarioActor });
    expect(propios).toHaveLength(1);
    expect(propios[0].userId).toBe(funcionarioActor.id);
    expect(ctx.notificaciones.items).toHaveLength(1); // el funcionario no genera alertas
  });

  it('muestra "Inactivo" para contratos finalizados y finaliza vencidos al listar', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-09-30'));
    const listar = new ListarContratosUseCase(ctx.contratos, ctx.sincronizar, ctx.notificar, ctx.clock);
    const [c] = await listar.execute({ actor: adminActor });
    expect(c.estado).toBe('finalizado');
    expect(c.estadoNombre).toBe('Inactivo');
    expect(c.diasParaVencer).toBe(-8);
  });

  it('un funcionario no puede ver contratos ajenos ni sus prórrogas', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(3, '2026-12-31'));
    const obtener = new ObtenerContratoUseCase(ctx.contratos, ctx.clock);
    await expect(obtener.execute({ actor: funcionarioActor, id: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(obtener.execute({ actor: adminActor, id: 1 })).resolves.toMatchObject({ id: 1 });
    await expect(obtener.execute({ actor: adminActor, id: 99 })).rejects.toBeInstanceOf(NotFoundError);
    const listarProrrogas = new ListarProrrogasUseCase(ctx.contratos, ctx.prorrogas);
    await expect(listarProrrogas.execute({ actor: funcionarioActor, contratoId: 1 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('Guardar y eliminar contratos', () => {
  it('crea un contrato validando el colaborador y sincroniza estados', async () => {
    const ctx = contexto();
    const guardar = new GuardarContratoUseCase(ctx.contratos, ctx.usuarios, ctx.sincronizar, ctx.clock);
    const dto = await guardar.execute({
      userId: 2,
      tipoContrato: 'fijo',
      numeroContrato: ' CT-100 ',
      fechaInicio: '2026-10-01',
      fechaFin: '2027-03-31',
      salarioBase: 1_800_000.456,
      observaciones: '',
    });
    expect(dto).toMatchObject({
      id: 1,
      numeroContrato: 'CT-100',
      salarioBase: 1_800_000.46,
      estado: 'activo',
      observaciones: null,
      colaboradorNombre: 'Juan Pérez',
    });
    await expect(
      guardar.execute({
        userId: 99,
        tipoContrato: 'fijo',
        numeroContrato: 'X',
        fechaInicio: '2026-01-01',
        fechaFin: null,
        salarioBase: 1,
        observaciones: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      guardar.execute({
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'X',
        fechaInicio: '2026-01-01',
        fechaFin: '2025-01-01',
        salarioBase: 1,
        observaciones: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('al editar conserva el colaborador original y finaliza si la nueva fecha fin ya pasó', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-12-31'));
    const guardar = new GuardarContratoUseCase(ctx.contratos, ctx.usuarios, ctx.sincronizar, ctx.clock);
    const dto = await guardar.execute({
      id: 1,
      userId: 3,
      tipoContrato: 'obra_labor',
      numeroContrato: 'CT-2',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-09-30',
      salarioBase: 2_000_000,
      estado: 'activo',
      observaciones: 'Cambio',
    });
    expect(dto.userId).toBe(2);
    expect(dto.estado).toBe('finalizado');
    expect(ctx.usuarios.items[1].estadoColaborador).toBe('inactivo');
    await expect(
      guardar.execute({
        id: 9,
        userId: 2,
        tipoContrato: 'fijo',
        numeroContrato: 'X',
        fechaInicio: '2026-01-01',
        fechaFin: null,
        salarioBase: 1,
        observaciones: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('elimina contratos existentes', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, null));
    const eliminar = new EliminarContratoUseCase(ctx.contratos, ctx.sincronizar);
    await eliminar.execute(1);
    expect(ctx.contratos.items).toHaveLength(0);
    expect(ctx.usuarios.items[1].estadoColaborador).toBe('inactivo');
    await expect(eliminar.execute(1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lista colaboradores (sin admins) para el formulario', async () => {
    const ctx = contexto();
    const lista = await new ListarColaboradoresUseCase(ctx.usuarios).execute();
    expect(lista.map((c) => c.id)).toEqual([2, 3, 4]);
    expect(lista[0]).toEqual({ id: 2, firstName: 'Juan', lastName: 'Pérez', cedula: '123', cargoNombre: 'Analista' });
  });
});

describe('Registrar prórroga', () => {
  it('guarda la prórroga, actualiza el contrato y devuelve la nueva fecha fin', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-31', { estado: 'activo' }));
    const uc = new RegistrarProrrogaUseCase(ctx.contratos, ctx.prorrogas, ctx.usuarios, ctx.clock);
    const r = await uc.execute({
      actor: adminActor,
      contratoId: 1,
      meses: 2,
      observacion: ' Por necesidad del servicio ',
    });
    expect(r).toEqual({ contratoId: 1, fechaFinAnterior: '2026-10-31', fechaFinNueva: '2026-12-31', meses: 2 });
    expect(ctx.contratos.items[0].props.fechaFin).toBe('2026-12-31');
    expect(ctx.prorrogas.items[0]).toMatchObject({
      contratoId: 1,
      userId: 2,
      fechaInicioProrroga: '2026-11-01',
      mesesProrroga: 2,
      observacion: 'Por necesidad del servicio',
      creadoPor: adminActor.id,
    });
    const historial = await new ListarProrrogasUseCase(ctx.contratos, ctx.prorrogas).execute({
      actor: adminActor,
      contratoId: 1,
    });
    expect(historial).toHaveLength(1);
  });

  it('reactiva un contrato finalizado y vuelve a activar al colaborador', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-09-30', { estado: 'finalizado' }));
    ctx.usuarios.items[1].estadoColaborador = 'inactivo';
    await new RegistrarProrrogaUseCase(ctx.contratos, ctx.prorrogas, ctx.usuarios, ctx.clock).execute({
      actor: adminActor,
      contratoId: 1,
      meses: 3,
      observacion: '',
    });
    expect(ctx.contratos.items[0].props).toMatchObject({ estado: 'activo', fechaFin: '2026-12-31' });
    expect(ctx.usuarios.items[1].estadoColaborador).toBe('activo');
  });

  it('rechaza meses inválidos, contratos sin fecha fin, inexistentes y actores no admin', async () => {
    const ctx = contexto();
    await ctx.contratos.save(contrato(2, '2026-10-31'));
    await ctx.contratos.save(contrato(3, null));
    const uc = new RegistrarProrrogaUseCase(ctx.contratos, ctx.prorrogas, ctx.usuarios, ctx.clock);
    await expect(uc.execute({ actor: adminActor, contratoId: 1, meses: 0, observacion: '' })).rejects.toThrow(
      'Debes indicar una cantidad de meses válida para la prórroga.',
    );
    await expect(uc.execute({ actor: adminActor, contratoId: 2, meses: 1, observacion: '' })).rejects.toThrow(
      'Contrato inválido o sin fecha fin.',
    );
    await expect(uc.execute({ actor: adminActor, contratoId: 9, meses: 1, observacion: '' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      uc.execute({ actor: funcionarioActor, contratoId: 1, meses: 1, observacion: '' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.prorrogas.items).toHaveLength(0);
  });
});
