import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { estadoCanonico, prioridadCanonica } from '../../../domain/tarea';
import {
  CambiarEstadoTareaUseCase,
  EliminarTareaUseCase,
  GetEstadisticasTareasUseCase,
  GetKanbanUseCase,
  GetTareaUseCase,
  GuardarTareaUseCase,
} from '../tareas.use-cases';
import {
  InMemoryNotificacionesPort,
  InMemoryTareaRepository,
  InMemoryUsuariosPort,
} from './in-memory-colaboracion.repositories';

describe('Dominio Tarea', () => {
  it('canoniza estados y prioridades como el legado', () => {
    expect(estadoCanonico('In Progress')).toBe('Inprogress');
    expect(estadoCanonico('Done')).toBe('Completed');
    expect(estadoCanonico('')).toBe('Unassigned');
    expect(estadoCanonico('cualquier cosa')).toBe('Unassigned');
    expect(prioridadCanonica('high')).toBe('Alta');
    expect(prioridadCanonica(undefined)).toBe('Media');
  });
});

describe('Casos de uso de Tareas', () => {
  let tareas: InMemoryTareaRepository;
  let usuarios: InMemoryUsuariosPort;
  let notificaciones: InMemoryNotificacionesPort;
  let guardar: GuardarTareaUseCase;
  const clock = new FakeClock();

  beforeEach(() => {
    tareas = new InMemoryTareaRepository();
    usuarios = new InMemoryUsuariosPort();
    notificaciones = new InMemoryNotificacionesPort();
    guardar = new GuardarTareaUseCase(tareas, usuarios, notificaciones, clock);
  });

  it('crea una tarea con el actor como creador y notifica a los asignados (no al propio actor)', async () => {
    const dto = await guardar.execute({
      actor: funcionarioActor,
      input: { titulo: 'Informe mensual', asignadoIds: [2, 3], prioridad: 'Alta', fechaLimite: '2026-10-31' },
    });
    expect(dto.creadorId).toBe(funcionarioActor.id);
    expect(dto.estado).toBe('To Do');
    expect(dto.asignados.map((a) => a.nombre)).toEqual(['Juan Pérez', 'Ana Ruiz']);
    expect(dto.puedeModificar).toBe(true);
    expect(notificaciones.creadas).toHaveLength(1);
    expect(notificaciones.creadas[0]).toMatchObject({ userId: 3, tipo: 'tarea', link: '/tareas/1' });
  });

  it('rechaza título vacío, fecha inválida y asignados inexistentes', async () => {
    await expect(guardar.execute({ actor: adminActor, input: { titulo: '  ' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      guardar.execute({ actor: adminActor, input: { titulo: 'X', fechaLimite: '31/10/2026' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      guardar.execute({ actor: adminActor, input: { titulo: 'X', asignadoIds: [99] } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sólo el creador o el admin pueden editar, cambiar estado o eliminar', async () => {
    const creada = await guardar.execute({ actor: funcionarioActor, input: { titulo: 'Mía' } });
    const otro = { ...funcionarioActor, id: 3, username: 'aruiz' };
    await expect(guardar.execute({ actor: otro, input: { id: creada.id, titulo: 'Hack' } })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      new CambiarEstadoTareaUseCase(tareas, usuarios, clock).execute({
        actor: otro,
        id: creada.id,
        estado: 'Completed',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(new EliminarTareaUseCase(tareas).execute({ actor: otro, id: creada.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const editada = await guardar.execute({ actor: adminActor, input: { id: creada.id, titulo: 'Editada por admin' } });
    expect(editada.titulo).toBe('Editada por admin');
    expect(editada.creadorId).toBe(funcionarioActor.id); // el creador no cambia
    const cambiada = await new CambiarEstadoTareaUseCase(tareas, usuarios, clock).execute({
      actor: funcionarioActor,
      id: creada.id,
      estado: 'In Review',
    });
    expect(cambiada.estado).toBe('In Reviews');
    await new EliminarTareaUseCase(tareas).execute({ actor: adminActor, id: creada.id });
    expect(tareas.items).toHaveLength(0);
  });

  it('al editar sólo notifica a los asignados nuevos', async () => {
    const creada = await guardar.execute({ actor: adminActor, input: { titulo: 'T', asignadoIds: [2] } });
    notificaciones.creadas = [];
    await guardar.execute({ actor: adminActor, input: { id: creada.id, titulo: 'T', asignadoIds: [2, 3] } });
    expect(notificaciones.creadas.map((n) => n.userId)).toEqual([3]);
  });

  it('agrupa el kanban por estado y calcula estadísticas', async () => {
    await guardar.execute({ actor: adminActor, input: { titulo: 'A', estado: 'To Do' } });
    await guardar.execute({ actor: adminActor, input: { titulo: 'B', estado: 'Completed' } });
    await guardar.execute({ actor: adminActor, input: { titulo: 'C', estado: 'Completed' } });
    const kanban = await new GetKanbanUseCase(tareas, usuarios).execute(funcionarioActor);
    expect(kanban['To Do'].map((t) => t.titulo)).toEqual(['A']);
    expect(kanban.Completed).toHaveLength(2);
    expect(kanban.Unassigned).toEqual([]);
    expect(kanban.Completed[0].puedeModificar).toBe(false); // funcionario no es el creador
    expect(await new GetEstadisticasTareasUseCase(tareas).execute()).toEqual({
      total: 3,
      sinAsignar: 0,
      porHacer: 1,
      enProgreso: 0,
      enRevision: 0,
      completadas: 2,
    });
  });

  it('el detalle de una tarea inexistente responde NotFound', async () => {
    await expect(new GetTareaUseCase(tareas, usuarios).execute({ actor: adminActor, id: 7 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
