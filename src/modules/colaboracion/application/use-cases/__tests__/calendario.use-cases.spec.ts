import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { normalizarFechaHora } from '../../../domain/evento-calendario';
import { EliminarEventoUseCase, fechaEnAnio, GuardarEventoUseCase, ListEventosUseCase } from '../calendario.use-cases';
import { InMemoryEventoRepository, InMemoryEventosSistemaPort } from './in-memory-colaboracion.repositories';

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
  const clock = new FakeClock(new Date('2026-10-08T10:00:00.000Z'));

  beforeEach(() => {
    eventos = new InMemoryEventoRepository();
    sistema = new InMemoryEventosSistemaPort();
  });

  it('crea, lista por rango y sólo muestra los eventos del propio usuario', async () => {
    const guardar = new GuardarEventoUseCase(eventos);
    await guardar.execute({
      actor: funcionarioActor,
      input: { titulo: 'Reunión', inicio: '2026-10-15T09:00', fin: '2026-10-15T10:00' },
    });
    await guardar.execute({ actor: funcionarioActor, input: { titulo: 'Noviembre', inicio: '2026-11-02' } });
    await guardar.execute({ actor: adminActor, input: { titulo: 'Del admin', inicio: '2026-10-20' } });

    const lista = new ListEventosUseCase(eventos, sistema, clock);
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
    const lista = new ListEventosUseCase(eventos, sistema, clock);
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
    const guardar = new GuardarEventoUseCase(eventos);
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
    const creado = await new GuardarEventoUseCase(eventos).execute({
      actor: adminActor,
      input: { titulo: 'Del admin', inicio: '2026-10-20' },
    });
    await expect(
      new GuardarEventoUseCase(eventos).execute({
        actor: funcionarioActor,
        input: { id: Number(creado.id), titulo: 'Hack', inicio: '2026-10-20' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new EliminarEventoUseCase(eventos).execute({ actor: funcionarioActor, id: Number(creado.id) }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await new EliminarEventoUseCase(eventos).execute({ actor: adminActor, id: Number(creado.id) });
    expect(eventos.items).toHaveLength(0);
  });
});
