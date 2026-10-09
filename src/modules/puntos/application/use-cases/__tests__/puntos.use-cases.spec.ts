import { InvalidOperationError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, funcionarioActor } from '../../../../../shared/testing';
import { Recompensa } from '../../../domain/recompensa';
import { AsignarPuntosUseCase, ListColaboradoresUseCase } from '../admin.use-cases';
import { GetMiBalanceUseCase, ListMisTransaccionesUseCase, ListRecompensasUseCase } from '../balance.use-cases';
import {
  CanjearRecompensaUseCase,
  ListCanjesUseCase,
  ListMisCanjesUseCase,
  ResolverCanjeUseCase,
} from '../canjes.use-cases';
import { buildInMemoryPuntos } from './in-memory-puntos.repositories';

describe('Casos de uso de Puntos', () => {
  let ctx: ReturnType<typeof buildInMemoryPuntos>;
  let clock: FakeClock;

  const recompensa = (id: number, puntos: number, estado = 'activo') =>
    Recompensa.create({
      id,
      nombre: `Recompensa ${id}`,
      descripcion: null,
      puntosRequeridos: puntos,
      tipo: 'dia_libre',
      estado,
    });

  beforeEach(() => {
    ctx = buildInMemoryPuntos();
    clock = new FakeClock();
    ctx.colaboradores.items = [
      { id: funcionarioActor.id, nombre: 'Juan Pérez', cedula: '123', cargoNombre: 'Analista' },
    ];
    ctx.canjes.nombres = { [funcionarioActor.id]: 'Juan Pérez', [adminActor.id]: 'Administrador Sistema' };
  });

  const asignar = (cantidad: number, concepto = 'Buen desempeño', userId = funcionarioActor.id) =>
    new AsignarPuntosUseCase(ctx.uow, ctx.colaboradores, ctx.notificaciones, clock).execute({
      userId,
      cantidad,
      concepto,
    });

  describe('Balance', () => {
    it('crea el balance en cero la primera vez que se consulta', async () => {
      const dto = await new GetMiBalanceUseCase(ctx.balances).execute(funcionarioActor);
      expect(dto).toMatchObject({
        userId: funcionarioActor.id,
        puntosActuales: 0,
        puntosTotalesGanados: 0,
        puntosTotalesCanjeados: 0,
      });
      expect(ctx.balances.items.has(funcionarioActor.id)).toBe(true);
    });

    it('lista el historial propio más reciente primero y respeta el límite', async () => {
      await asignar(10, 'Uno');
      clock.advanceMinutes(1);
      await asignar(20, 'Dos');
      clock.advanceMinutes(1);
      await asignar(30, 'Tres');
      const todas = await new ListMisTransaccionesUseCase(ctx.transacciones).execute({ actor: funcionarioActor });
      expect(todas.map((t) => t.concepto)).toEqual(['Tres', 'Dos', 'Uno']);
      const dos = await new ListMisTransaccionesUseCase(ctx.transacciones).execute({
        actor: funcionarioActor,
        limit: 2,
      });
      expect(dos).toHaveLength(2);
      // El historial de otro usuario no se mezcla.
      expect(await new ListMisTransaccionesUseCase(ctx.transacciones).execute({ actor: adminActor })).toHaveLength(0);
    });
  });

  describe('Asignar puntos (admin)', () => {
    it('registra el movimiento ganado, actualiza totales y notifica al colaborador', async () => {
      const balance = await asignar(50, 'Excelente trabajo');
      expect(balance).toMatchObject({ puntosActuales: 50, puntosTotalesGanados: 50, puntosTotalesCanjeados: 0 });
      expect(ctx.transacciones.items[0].props).toMatchObject({
        tipo: 'ganado',
        cantidad: 50,
        concepto: 'Excelente trabajo',
        userId: funcionarioActor.id,
      });
      expect(ctx.notificaciones.publicadas).toHaveLength(1);
      expect(ctx.notificaciones.publicadas[0]).toMatchObject({
        userId: funcionarioActor.id,
        tipo: 'puntos',
        titulo: 'Puntos asignados',
      });
      expect(ctx.notificaciones.publicadas[0].mensaje).toContain('50 puntos');
    });

    it('acumula sobre un balance existente', async () => {
      await asignar(50);
      const balance = await asignar(25);
      expect(balance.puntosActuales).toBe(75);
      expect(balance.puntosTotalesGanados).toBe(75);
    });

    it('rechaza cantidades no positivas y conceptos vacíos', async () => {
      await expect(asignar(0)).rejects.toBeInstanceOf(ValidationError);
      await expect(asignar(-5)).rejects.toBeInstanceOf(ValidationError);
      await expect(asignar(5, '   ')).rejects.toBeInstanceOf(ValidationError);
      expect(ctx.transacciones.items).toHaveLength(0);
    });

    it('falla si el colaborador no existe', async () => {
      await expect(asignar(5, 'X', 999)).rejects.toBeInstanceOf(NotFoundError);
      expect(ctx.notificaciones.publicadas).toHaveLength(0);
    });

    it('lista los colaboradores activos', async () => {
      const lista = await new ListColaboradoresUseCase(ctx.colaboradores).execute();
      expect(lista).toEqual([
        { id: funcionarioActor.id, nombre: 'Juan Pérez', cedula: '123', cargoNombre: 'Analista' },
      ]);
    });
  });

  describe('Recompensas y canje', () => {
    beforeEach(() => {
      ctx.recompensas.items = [recompensa(1, 100), recompensa(2, 50), recompensa(3, 10, 'inactivo')];
      ctx.canjes.recompensas = { 1: 'Recompensa 1', 2: 'Recompensa 2' };
    });

    it('lista sólo recompensas activas ordenadas por puntos', async () => {
      const lista = await new ListRecompensasUseCase(ctx.recompensas).execute();
      expect(lista.map((r) => r.id)).toEqual([2, 1]);
    });

    it('canjea: descuenta puntos, registra "canjeado" y crea el canje pendiente', async () => {
      await asignar(120);
      const canje = await new CanjearRecompensaUseCase(ctx.uow, clock).execute({
        actor: funcionarioActor,
        recompensaId: 1,
      });
      expect(canje).toMatchObject({
        estado: 'pendiente',
        puntosUsados: 100,
        recompensaNombre: 'Recompensa 1',
        colaboradorNombre: 'Juan Pérez',
      });
      const balance = await new GetMiBalanceUseCase(ctx.balances).execute(funcionarioActor);
      expect(balance).toMatchObject({ puntosActuales: 20, puntosTotalesGanados: 120, puntosTotalesCanjeados: 100 });
      const mov = ctx.transacciones.items.find((t) => t.props.tipo === 'canjeado');
      expect(mov?.props).toMatchObject({ cantidad: 100, referenciaId: canje.id });
    });

    it('rechaza el canje sin puntos suficientes (422) sin crear nada', async () => {
      await asignar(30);
      await expect(
        new CanjearRecompensaUseCase(ctx.uow, clock).execute({ actor: funcionarioActor, recompensaId: 2 }),
      ).rejects.toBeInstanceOf(InvalidOperationError);
      expect(ctx.canjes.items).toHaveLength(0);
      expect((await ctx.balances.findByUserId(funcionarioActor.id))?.puntosActuales).toBe(30);
    });

    it('no permite canjear recompensas inexistentes o inactivas', async () => {
      await asignar(500);
      const uc = new CanjearRecompensaUseCase(ctx.uow, clock);
      await expect(uc.execute({ actor: funcionarioActor, recompensaId: 3 })).rejects.toBeInstanceOf(NotFoundError);
      await expect(uc.execute({ actor: funcionarioActor, recompensaId: 99 })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('crea el balance en cero si el usuario nunca lo tuvo y entonces rechaza', async () => {
      await expect(
        new CanjearRecompensaUseCase(ctx.uow, clock).execute({ actor: funcionarioActor, recompensaId: 2 }),
      ).rejects.toBeInstanceOf(InvalidOperationError);
      expect(ctx.balances.items.has(funcionarioActor.id)).toBe(true);
    });

    it('lista los canjes propios', async () => {
      await asignar(200);
      await new CanjearRecompensaUseCase(ctx.uow, clock).execute({ actor: funcionarioActor, recompensaId: 2 });
      expect(await new ListMisCanjesUseCase(ctx.canjes).execute(funcionarioActor)).toHaveLength(1);
      expect(await new ListMisCanjesUseCase(ctx.canjes).execute(adminActor)).toHaveLength(0);
    });
  });

  describe('Resolver canjes (admin)', () => {
    let canjeId: number;
    beforeEach(async () => {
      ctx.recompensas.items = [recompensa(1, 100)];
      ctx.canjes.recompensas = { 1: 'Recompensa 1' };
      await asignar(150);
      ctx.notificaciones.publicadas = [];
      canjeId = (
        await new CanjearRecompensaUseCase(ctx.uow, clock).execute({ actor: funcionarioActor, recompensaId: 1 })
      ).id;
    });

    const resolver = () => new ResolverCanjeUseCase(ctx.uow, ctx.notificaciones, clock);

    it('lista pendientes por defecto y todos con "todos"', async () => {
      const pendientes = await new ListCanjesUseCase(ctx.canjes).execute({ estado: 'pendiente' });
      expect(pendientes).toHaveLength(1);
      expect(pendientes[0]).toMatchObject({
        colaboradorNombre: 'Juan Pérez',
        recompensaNombre: 'Recompensa 1',
        puntosUsados: 100,
      });
      await resolver().execute({ actor: adminActor, canjeId, accion: 'aprobado' });
      expect(await new ListCanjesUseCase(ctx.canjes).execute({ estado: 'pendiente' })).toHaveLength(0);
      expect(await new ListCanjesUseCase(ctx.canjes).execute({ estado: 'todos' })).toHaveLength(1);
    });

    it('aprueba: cambia el estado, guarda quién aprobó y no toca el saldo (ya descontado)', async () => {
      const dto = await resolver().execute({ actor: adminActor, canjeId, accion: 'aprobado' });
      expect(dto).toMatchObject({
        estado: 'aprobado',
        aprobadoPor: adminActor.id,
        aprobadoPorNombre: 'Administrador Sistema',
      });
      const balance = await ctx.balances.findByUserId(funcionarioActor.id);
      expect(balance?.props).toMatchObject({ puntosActuales: 50, puntosTotalesCanjeados: 100 });
      expect(ctx.notificaciones.publicadas[0]).toMatchObject({
        userId: funcionarioActor.id,
        tipo: 'puntos',
        titulo: 'Canje aprobado',
      });
    });

    it('rechaza: reintegra los puntos y registra el movimiento "reintegro"', async () => {
      const dto = await resolver().execute({ actor: adminActor, canjeId, accion: 'rechazado' });
      expect(dto.estado).toBe('rechazado');
      const balance = await ctx.balances.findByUserId(funcionarioActor.id);
      expect(balance?.props).toMatchObject({
        puntosActuales: 150,
        puntosTotalesGanados: 150,
        puntosTotalesCanjeados: 0,
      });
      const reintegro = ctx.transacciones.items.find((t) => t.props.tipo === 'reintegro');
      expect(reintegro?.props).toMatchObject({ cantidad: 100, referenciaId: canjeId, userId: funcionarioActor.id });
      expect(ctx.notificaciones.publicadas[0].titulo).toBe('Canje rechazado');
    });

    it('no permite procesar dos veces el mismo canje (422)', async () => {
      await resolver().execute({ actor: adminActor, canjeId, accion: 'aprobado' });
      await expect(resolver().execute({ actor: adminActor, canjeId, accion: 'rechazado' })).rejects.toBeInstanceOf(
        InvalidOperationError,
      );
      expect((await ctx.balances.findByUserId(funcionarioActor.id))?.puntosActuales).toBe(50);
    });

    it('falla con un canje inexistente', async () => {
      await expect(resolver().execute({ actor: adminActor, canjeId: 999, accion: 'aprobado' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
