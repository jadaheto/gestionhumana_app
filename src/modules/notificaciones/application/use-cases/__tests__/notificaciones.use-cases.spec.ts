import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import {
  CountNoLeidasUseCase,
  CrearNotificacionUseCase,
  EliminarNotificacionUseCase,
  ListNotificacionesUseCase,
  MarcarLeidaUseCase,
  MarcarTodasLeidasUseCase,
} from '../notificaciones.use-cases';
import { InMemoryNotificacionRepository } from './in-memory-notificacion.repository';

describe('Casos de uso de Notificaciones', () => {
  let repo: InMemoryNotificacionRepository;
  let clock: FakeClock;
  let crear: CrearNotificacionUseCase;

  beforeEach(() => {
    repo = new InMemoryNotificacionRepository();
    clock = new FakeClock();
    crear = new CrearNotificacionUseCase(repo, clock);
  });

  async function sembrar(): Promise<void> {
    for (let i = 1; i <= 3; i++) {
      await crear.execute({
        userId: funcionarioActor.id,
        titulo: `Aviso ${i}`,
        mensaje: `Mensaje ${i}`,
        tipo: 'puntos',
        link: '/puntos/mi-balance',
      });
      clock.advanceMinutes(1);
    }
    await crear.execute({ userId: adminActor.id, titulo: 'Para el admin' });
  }

  it('crea notificaciones con valores por defecto y valida el título', async () => {
    const dto = await crear.execute({ userId: funcionarioActor.id, titulo: '  Hola  ' });
    expect(dto).toMatchObject({ titulo: 'Hola', mensaje: null, tipo: 'info', leida: false, link: null });
    expect(dto.createdAt).toBe(clock.now().toISOString());
    await expect(crear.execute({ userId: funcionarioActor.id, titulo: ' ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('lista las propias, más recientes primero, con el contador de no leídas', async () => {
    await sembrar();
    const lista = await new ListNotificacionesUseCase(repo).execute({ actor: funcionarioActor });
    expect(lista.noLeidas).toBe(3);
    expect(lista.items.map((n) => n.titulo)).toEqual(['Aviso 3', 'Aviso 2', 'Aviso 1']);
    const limitada = await new ListNotificacionesUseCase(repo).execute({ actor: funcionarioActor, limit: 2 });
    expect(limitada.items).toHaveLength(2);
    expect(limitada.noLeidas).toBe(3); // el contador es global, no de la página
  });

  it('filtra sólo no leídas', async () => {
    await sembrar();
    await new MarcarLeidaUseCase(repo).execute({ actor: funcionarioActor, id: 1 });
    const lista = await new ListNotificacionesUseCase(repo).execute({ actor: funcionarioActor, soloNoLeidas: true });
    expect(lista.items.map((n) => n.id)).toEqual([3, 2]);
    expect(lista.noLeidas).toBe(2);
    expect(await new CountNoLeidasUseCase(repo).execute(funcionarioActor)).toEqual({ noLeidas: 2 });
  });

  it('marca una como leída sólo si es propia', async () => {
    await sembrar();
    await new MarcarLeidaUseCase(repo).execute({ actor: funcionarioActor, id: 2 });
    expect(repo.items.find((n) => n.id === 2)?.leida).toBe(true);
    // La del admin (id 4) no es del funcionario → 404
    await expect(new MarcarLeidaUseCase(repo).execute({ actor: funcionarioActor, id: 4 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(new MarcarLeidaUseCase(repo).execute({ actor: funcionarioActor, id: 99 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('marca todas las propias y devuelve cuántas cambiaron', async () => {
    await sembrar();
    expect(await new MarcarTodasLeidasUseCase(repo).execute(funcionarioActor)).toEqual({ marcadas: 3 });
    expect(await new CountNoLeidasUseCase(repo).execute(funcionarioActor)).toEqual({ noLeidas: 0 });
    expect(await new CountNoLeidasUseCase(repo).execute(adminActor)).toEqual({ noLeidas: 1 });
    expect(await new MarcarTodasLeidasUseCase(repo).execute(funcionarioActor)).toEqual({ marcadas: 0 });
  });

  it('elimina sólo notificaciones propias', async () => {
    await sembrar();
    await new EliminarNotificacionUseCase(repo).execute({ actor: funcionarioActor, id: 1 });
    expect(repo.items.find((n) => n.id === 1)).toBeUndefined();
    await expect(
      new EliminarNotificacionUseCase(repo).execute({ actor: funcionarioActor, id: 4 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.items.find((n) => n.id === 4)).toBeDefined();
  });
});
