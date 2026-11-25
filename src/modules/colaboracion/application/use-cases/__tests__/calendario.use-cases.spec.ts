import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { normalizarFechaHora } from '../../../domain/evento-calendario';
import {
  EliminarEventoUseCase,
  fechaEnAnio,
  GetPermisosCalendarioUseCase,
  GuardarEventoUseCase,
  ListEventosUseCase,
} from '../calendario.use-cases';
import {
  InMemoryEventoRepository,
  InMemoryEventosSistemaPort,
  InMemoryUsuariosPort,
} from './in-memory-colaboracion.repositories';

describe('Normalización de fechas del calendario', () => {
  it('completa la hora a medianoche cuando sólo hay fecha', () => {
    expect(normalizarFechaHora('2026-10-15')).toBe('2026-10-15T00:00:00');
    expect(normalizarFechaHora('2026-10-15 09:30')).toBe('2026-10-15T09:30:00');
    expect(normalizarFechaHora('2026-10-15T09:30:15')).toBe('2026-10-15T09:30:15');
    expect(normalizarFechaHora('15/10/2026')).toBeNull();
    expect(normalizarFechaHora('2026-10-15T25:00')).toBeNull();
  });

  it('proyecta el 29 de febrero al 28 en años no bisiestos', () => {
    expect(fechaEnAnio('1996-02-29', 2026)).toBe('2026-02-28');
    expect(fechaEnAnio('1996-02-29', 2028)).toBe('2028-02-29');
  });
});

describe('Casos de uso de Calendario', () => {
  let eventos: InMemoryEventoRepository;
  let sistema: InMemoryEventosSistemaPort;
  let usuarios: InMemoryUsuariosPort;
  const clock = new FakeClock(new Date('2026-10-08T10:00:00.000Z'));

  beforeEach(() => {
    eventos = new InMemoryEventoRepository();
    sistema = new InMemoryEventosSistemaPort();
    usuarios = new InMemoryUsuariosPort();
  });

  it('crea, lista por rango y sólo muestra los eventos del propio usuario', async () => {
    const guardar = new GuardarEventoUseCase(eventos, usuarios);
    await guardar.execute({
      actor: funcionarioActor,
      input: { titulo: 'Reunión', inicio: '2026-10-15T09:00', fin: '2026-10-15T10:00' },
    });
    await guardar.execute({ actor: funcionarioActor, input: { titulo: 'Noviembre', inicio: '2026-11-02' } });
    await guardar.execute({ actor: adminActor, input: { titulo: 'Del admin', inicio: '2026-10-20' } });

    const lista = new ListEventosUseCase(eventos, sistema, clock, usuarios);
    const octubre = await lista.execute({ actor: funcionarioActor, desde: '2026-10-01', hasta: '2026-10-31' });
    expect(octubre.map((e) => e.titulo)).toEqual(['Reunión']);
    expect(octubre[0].inicio).toBe('2026-10-15T09:00:00');
    expect(octubre[0].esDeSistema).toBe(false);
    await expect(lista.execute({ actor: funcionarioActor, desde: '2026/10/01' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('incluye cumpleaños y aniversarios del sistema dentro del rango', async () => {
    sistema.items = [
      { tipo: 'cumpleanos', userId: 3, nombre: 'Ana Ruiz', areaNombre: 'TI', fechaOrigen: '1990-10-20' },
      { tipo: 'aniversario', userId: 3, nombre: 'Ana Ruiz', areaNombre: 'TI', fechaOrigen: '2024-10-25' },
      { tipo: 'aniversario', userId: 4, nombre: 'Nuevo', areaNombre: null, fechaOrigen: '2026-10-01' }, // < 1 año: no aparece
    ];
    const lista = new ListEventosUseCase(eventos, sistema, clock, usuarios);
    const r = await lista.execute({ actor: funcionarioActor, desde: '2026-10-01', hasta: '2026-10-31' });
    expect(r.map((e) => e.titulo)).toEqual(['Cumpleaños: Ana Ruiz', 'Aniversario (2 años): Ana Ruiz']);
    expect(r.every((e) => e.esDeSistema && e.todoElDia)).toBe(true);
    const sinSistema = await lista.execute({
      actor: funcionarioActor,
      desde: '2026-10-01',
      hasta: '2026-10-31',
      incluirSistema: false,
    });
    expect(sinSistema).toEqual([]);
  });

  it('valida título, fechas y orden de inicio/fin', async () => {
    const guardar = new GuardarEventoUseCase(eventos, usuarios);
    await expect(
      guardar.execute({ actor: adminActor, input: { titulo: '', inicio: '2026-10-15' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(guardar.execute({ actor: adminActor, input: { titulo: 'X', inicio: 'ayer' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      guardar.execute({
        actor: adminActor,
        input: { titulo: 'X', inicio: '2026-10-15T10:00', fin: '2026-10-15T09:00' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('no permite editar ni eliminar eventos de otro usuario', async () => {
    const creado = await new GuardarEventoUseCase(eventos, usuarios).execute({
      actor: adminActor,
      input: { titulo: 'Del admin', inicio: '2026-10-20' },
    });
    await expect(
      new GuardarEventoUseCase(eventos, usuarios).execute({
        actor: funcionarioActor,
        input: { id: Number(creado.id), titulo: 'Hack', inicio: '2026-10-20' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new EliminarEventoUseCase(eventos, usuarios).execute({ actor: funcionarioActor, id: Number(creado.id) }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await new EliminarEventoUseCase(eventos, usuarios).execute({ actor: adminActor, id: Number(creado.id) });
    expect(eventos.items).toHaveLength(0);
  });

  describe('eventos para todos los trabajadores', () => {
    const designadoActor = { ...funcionarioActor, id: 3, username: 'aruiz' };
    const general = { titulo: 'Jornada de salud', inicio: '2026-10-22', paraTodos: true };

    it('sólo Gestión Humana o un designado pueden crearlos', async () => {
      const guardar = new GuardarEventoUseCase(eventos, usuarios);
      await expect(guardar.execute({ actor: funcionarioActor, input: general })).rejects.toBeInstanceOf(ForbiddenError);
      expect(eventos.items).toHaveLength(0);

      expect((await guardar.execute({ actor: adminActor, input: general })).paraTodos).toBe(true);
      usuarios.designados.add(designadoActor.id);
      expect((await guardar.execute({ actor: designadoActor, input: general })).paraTodos).toBe(true);

      const permisos = new GetPermisosCalendarioUseCase(usuarios);
      expect(await permisos.execute(adminActor)).toEqual({ puedeCrearGenerales: true });
      expect(await permisos.execute(designadoActor)).toEqual({ puedeCrearGenerales: true });
      expect(await permisos.execute(funcionarioActor)).toEqual({ puedeCrearGenerales: false });
    });

    it('todos los ven, pero sólo su autor designado o un administrador los modifican', async () => {
      usuarios.designados.add(designadoActor.id);
      const guardar = new GuardarEventoUseCase(eventos, usuarios);
      const creado = await guardar.execute({ actor: designadoActor, input: general });
      const id = Number(creado.id);

      const lista = new ListEventosUseCase(eventos, sistema, clock, usuarios);
      const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
      const [visto] = await lista.execute({ actor: funcionarioActor, ...rango });
      expect(visto).toMatchObject({
        titulo: 'Jornada de salud',
        paraTodos: true,
        editable: false,
        creador: 'Ana Ruiz',
      });
      expect((await lista.execute({ actor: designadoActor, ...rango }))[0].editable).toBe(true);
      expect((await lista.execute({ actor: adminActor, ...rango }))[0].editable).toBe(true);

      await expect(
        guardar.execute({ actor: funcionarioActor, input: { ...general, id, titulo: 'Hack' } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        new EliminarEventoUseCase(eventos, usuarios).execute({ actor: funcionarioActor, id }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      // El administrador corrige el evento sin apropiárselo.
      await guardar.execute({
        actor: adminActor,
        input: { id, titulo: 'Jornada de salud (auditorio)', inicio: '2026-10-22' },
      });
      expect(eventos.items[0].props).toMatchObject({
        userId: 3,
        paraTodos: true,
        titulo: 'Jornada de salud (auditorio)',
      });

      // Si Gestión Humana le retira la designación, el autor ya no puede modificarlo.
      usuarios.designados.clear();
      await expect(
        new EliminarEventoUseCase(eventos, usuarios).execute({ actor: designadoActor, id }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await new EliminarEventoUseCase(eventos, usuarios).execute({ actor: adminActor, id });
      expect(eventos.items).toHaveLength(0);
    });

    it('un evento personal no puede volverse "para todos" sin permiso', async () => {
      const guardar = new GuardarEventoUseCase(eventos, usuarios);
      const propio = await guardar.execute({
        actor: funcionarioActor,
        input: { titulo: 'Cita', inicio: '2026-10-10' },
      });
      expect(propio.paraTodos).toBe(false);
      await expect(
        guardar.execute({
          actor: funcionarioActor,
          input: { id: Number(propio.id), titulo: 'Cita', inicio: '2026-10-10', paraTodos: true },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
