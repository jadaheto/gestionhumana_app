import { InvalidOperationError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, FakeClock, InMemoryFileStorage } from '../../../../../shared/testing/fakes';
import { TEXTO_NOMINA_DOS_EMPLEADOS } from '../../../domain/__tests__/nomina-fixtures';
import {
  CancelarImportacionUseCase,
  CerrarLotesAtascadosUseCase,
  ConfirmarImportacionUseCase,
  DETALLE_LOTE_ATASCADO,
  GetLoteUseCase,
  HistorialImportacionesUseCase,
  ObtenerPreviewUseCase,
  PrevisualizarImportacionUseCase,
  ProcesarLoteUseCase,
} from '../importacion-nomina.use-cases';
import {
  FakeNominaEmpleadoImporter,
  FakePdfTextExtractor,
  InMemoryNominaImportLoteRepository,
  InMemoryNominaPreviewStore,
  StubCedulasReader,
} from './in-memory-nomina.repositories';

const PDF = Buffer.from('%PDF-1.4 contenido');

function setup(texto = TEXTO_NOMINA_DOS_EMPLEADOS, registradas = new Set<string>()) {
  const storage = new InMemoryFileStorage();
  const extractor = new FakePdfTextExtractor(texto);
  const lotes = new InMemoryNominaImportLoteRepository();
  const previews = new InMemoryNominaPreviewStore();
  const clock = new FakeClock();
  const importer = new FakeNominaEmpleadoImporter();
  const previsualizar = new PrevisualizarImportacionUseCase(
    storage,
    extractor,
    new StubCedulasReader(registradas),
    lotes,
    previews,
    clock,
  );
  const confirmar = new ConfirmarImportacionUseCase(previews, lotes);
  const procesar = new ProcesarLoteUseCase(lotes, previews, importer);
  const cancelar = new CancelarImportacionUseCase(previews, storage);
  const cerrar = new CerrarLotesAtascadosUseCase(lotes, clock);
  const historial = new HistorialImportacionesUseCase(lotes, cerrar);
  return {
    storage,
    extractor,
    lotes,
    previews,
    clock,
    importer,
    previsualizar,
    confirmar,
    procesar,
    cancelar,
    cerrar,
    historial,
  };
}

const entrada = { actor: adminActor, archivo: PDF, nombreOriginal: 'nomina_abril.pdf', mimeType: 'application/pdf' };

describe('Fase 1: previsualizar importación', () => {
  it('guarda el PDF, parsea, marca existentes y devuelve el token', async () => {
    const s = setup(TEXTO_NOMINA_DOS_EMPLEADOS, new Set(['11028793102']));
    const p = await s.previsualizar.execute({ ...entrada, fuente: 'auto' });
    expect(p.token).toHaveLength(32);
    expect(p.archivoOriginal).toBe('nomina_abril.pdf');
    expect(p.parsed.meta.fuente).toBe('COLEGIO');
    expect(p.parsed.empleados.map((e) => e.existe)).toEqual([true, false]);
    expect(p.nuevos).toBe(1);
    expect(p.existentes).toBe(1);
    expect(p.lotePrevio).toBeNull();
    expect(p.loteId).toBeNull();
    expect([...s.storage.files.keys()][0]).toMatch(/^nomina\/.*\.pdf$/);
    expect(s.previews.items.get(p.token)?.createdBy).toBe(1);
  });

  it('fuerza la fuente indicada y detecta un lote previo del mismo período', async () => {
    const s = setup();
    await s.lotes.create({
      archivo: 'nomina/old.pdf',
      archivoOriginal: 'old.pdf',
      fuente: 'CAMPANOS',
      tipoNomina: '06',
      fechaLiquidacion: null,
      fechaInicio: '2026-04-16',
      fechaFin: '2026-04-30',
      totalEmpleadosPdf: 2,
      estado: 'completado',
      detalle: null,
      createdBy: 1,
    });
    const p = await s.previsualizar.execute({ ...entrada, fuente: 'campanos' });
    expect(p.parsed.meta.fuente).toBe('CAMPANOS');
    expect(p.lotePrevio).toMatchObject({ id: 1, estado: 'completado' });
  });

  it('rechaza PDFs sin texto o sin empleados y limpia el archivo', async () => {
    const vacio = setup('   ');
    await expect(vacio.previsualizar.execute(entrada)).rejects.toThrow('No se pudo leer texto del PDF');
    expect(vacio.storage.files.size).toBe(0);

    const sinEmpleados = setup('Fecha Liquidación: 04/30/2026');
    await expect(sinEmpleados.previsualizar.execute(entrada)).rejects.toThrow('No se detectaron bloques de empleados');
    expect(sinEmpleados.storage.files.size).toBe(0);

    await expect(setup().previsualizar.execute({ ...entrada, nombreOriginal: 'malo.txt' })).rejects.toThrow();
  });

  it('purga vistas previas de más de 24 horas', async () => {
    const s = setup();
    const vieja = await s.previews.save({
      parsed: {
        meta: {
          fechaLiquidacion: null,
          diasLiquidados: null,
          fechaInicio: null,
          fechaFin: null,
          tipoNomina: '',
          fuente: '',
        },
        empleados: [],
        totales: { totalLiquidadoPdf: null, totalEmpleadosPdf: null, sumaNetos: 0, empleadosDetectados: 0 },
        warnings: [],
      },
      archivo: 'nomina/x.pdf',
      archivoOriginal: 'x.pdf',
      nuevos: 0,
      existentes: 0,
      lotePrevio: null,
      loteId: null,
      procesados: 0,
      createdBy: 1,
      createdAt: new Date('2026-10-06T00:00:00Z'),
    });
    await s.previsualizar.execute(entrada);
    expect(s.previews.items.has(vieja.token)).toBe(false);
    expect(s.previews.items.size).toBe(1);
  });

  it('ObtenerPreview devuelve 404 si el token no existe', async () => {
    const s = setup();
    await expect(new ObtenerPreviewUseCase(s.previews).execute('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('Fase 2: confirmar, procesar por tandas y cerrar', () => {
  it('confirmar crea el lote en "procesando" y es idempotente ante doble clic', async () => {
    const s = setup();
    const p = await s.previsualizar.execute(entrada);
    const r1 = await s.confirmar.execute({ actor: adminActor, token: p.token });
    const r2 = await s.confirmar.execute({ actor: adminActor, token: p.token });
    expect(r1).toEqual({ loteId: 1, total: 2 });
    expect(r2).toEqual(r1);
    expect(s.lotes.lotes).toHaveLength(1);
    expect(s.lotes.lotes[0]).toMatchObject({
      estado: 'procesando',
      fuente: 'COLEGIO',
      tipoNomina: '06',
      fechaInicio: '2026-04-16',
      totalEmpleadosPdf: 2,
      createdBy: 1,
      archivoOriginal: 'nomina_abril.pdf',
    });
    await expect(s.confirmar.execute({ actor: adminActor, token: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('procesa por tandas, acumula contadores, registra errores y cierra como parcial', async () => {
    const s = setup();
    s.importer.existentes.add('1102879310');
    s.importer.fallan.add('64578123');
    const p = await s.previsualizar.execute(entrada);
    const { loteId } = await s.confirmar.execute({ actor: adminActor, token: p.token });

    const t1 = await s.procesar.execute({ loteId, size: 1 });
    expect(t1).toMatchObject({ processed: 1, total: 2, done: false, estado: 'procesando' });
    expect(t1.counts).toMatchObject({
      empleadosActualizados: 1,
      desprendiblesCreados: 1,
      contratosActualizados: 1,
      errores: 0,
    });
    expect(s.previews.items.get(p.token)?.procesados).toBe(1);

    // Sin offset: continúa donde quedó.
    const t2 = await s.procesar.execute({ loteId, size: 1 });
    expect(t2).toMatchObject({ processed: 2, total: 2, done: true, estado: 'parcial' });
    expect(t2.counts.errores).toBe(1);
    expect(s.importer.llamadas.map((l) => l.emp.cedula)).toEqual(['1102879310', '64578123']);
    expect(s.importer.llamadas[0].archivo).toMatch(/^nomina\//);
    expect(s.lotes.errores[0]).toMatchObject({
      loteId,
      empleadoRef: '64578123',
      mensaje: 'Fallo simulado para 64578123',
    });
    expect(s.lotes.errores[0].rawBlock).toContain('LOPEZ MARTINEZ');
    expect(s.lotes.lotes[0]).toMatchObject({ estado: 'parcial', detalle: 'Importación desde PDF nomina_abril.pdf' });
    expect(s.previews.items.has(p.token)).toBe(false);

    await expect(s.procesar.execute({ loteId })).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it('cierra como completado cuando no hay errores y procesa todo en una tanda', async () => {
    const s = setup();
    const p = await s.previsualizar.execute(entrada);
    const { loteId } = await s.confirmar.execute({ actor: adminActor, token: p.token });
    const t = await s.procesar.execute({ loteId, offset: 0, size: 10 });
    expect(t).toMatchObject({ processed: 2, done: true, estado: 'completado' });
    expect(t.counts).toMatchObject({ empleadosCreados: 2, desprendiblesCreados: 2, errores: 0 });
    expect(s.importer.sesiones).toBe(1);
  });

  it('procesar falla si el lote no existe o la vista previa expiró', async () => {
    const s = setup();
    await expect(s.procesar.execute({ loteId: 99 })).rejects.toBeInstanceOf(NotFoundError);
    await s.lotes.create({
      archivo: 'a',
      archivoOriginal: null,
      fuente: 'X',
      tipoNomina: '',
      fechaLiquidacion: null,
      fechaInicio: null,
      fechaFin: null,
      totalEmpleadosPdf: 1,
      estado: 'procesando',
      detalle: null,
      createdBy: 1,
    });
    await expect(s.procesar.execute({ loteId: 1 })).rejects.toThrow('La sesión de importación expiró');
  });

  it('cancelar elimina la vista previa y el PDF; no se puede cancelar un lote iniciado', async () => {
    const s = setup();
    const p = await s.previsualizar.execute(entrada);
    await s.cancelar.execute(p.token);
    expect(s.previews.items.size).toBe(0);
    expect(s.storage.files.size).toBe(0);

    const p2 = await s.previsualizar.execute(entrada);
    await s.confirmar.execute({ actor: adminActor, token: p2.token });
    await expect(s.cancelar.execute(p2.token)).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it('confirmar con vista previa sin empleados la descarta con error de validación', async () => {
    const s = setup();
    const vacia = await s.previews.save({
      parsed: {
        meta: {
          fechaLiquidacion: null,
          diasLiquidados: null,
          fechaInicio: null,
          fechaFin: null,
          tipoNomina: '',
          fuente: '',
        },
        empleados: [],
        totales: { totalLiquidadoPdf: null, totalEmpleadosPdf: null, sumaNetos: 0, empleadosDetectados: 0 },
        warnings: [],
      },
      archivo: 'nomina/x.pdf',
      archivoOriginal: 'x.pdf',
      nuevos: 0,
      existentes: 0,
      lotePrevio: null,
      loteId: null,
      procesados: 0,
      createdBy: 1,
      createdAt: new Date(),
    });
    await expect(s.confirmar.execute({ actor: adminActor, token: vacia.token })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(s.previews.items.size).toBe(0);
  });
});

describe('Historial y lotes atascados', () => {
  it('marca como error los lotes en procesando de más de 30 minutos', async () => {
    const s = setup();
    const viejo = await s.lotes.create({
      archivo: 'a',
      archivoOriginal: null,
      fuente: 'X',
      tipoNomina: '',
      fechaLiquidacion: null,
      fechaInicio: null,
      fechaFin: null,
      totalEmpleadosPdf: 1,
      estado: 'procesando',
      detalle: null,
      createdBy: 1,
    });
    viejo.createdAt = new Date('2026-10-08T09:00:00Z');
    const reciente = await s.lotes.create({
      archivo: 'b',
      archivoOriginal: null,
      fuente: 'X',
      tipoNomina: '',
      fechaLiquidacion: null,
      fechaInicio: null,
      fechaFin: null,
      totalEmpleadosPdf: 1,
      estado: 'procesando',
      detalle: null,
      createdBy: 1,
    });
    reciente.createdAt = new Date('2026-10-08T09:50:00Z');

    expect(await s.cerrar.execute()).toEqual({ cerrados: 1 });
    expect(viejo).toMatchObject({ estado: 'error', detalle: DETALLE_LOTE_ATASCADO });
    expect(reciente.estado).toBe('procesando');
  });

  it('historial devuelve los lotes más recientes primero con sus errores', async () => {
    const s = setup();
    await s.lotes.create({
      archivo: 'a',
      archivoOriginal: 'a.pdf',
      fuente: 'X',
      tipoNomina: '',
      fechaLiquidacion: null,
      fechaInicio: null,
      fechaFin: null,
      totalEmpleadosPdf: 1,
      estado: 'parcial',
      detalle: null,
      createdBy: 1,
    });
    await s.lotes.create({
      archivo: 'b',
      archivoOriginal: 'b.pdf',
      fuente: 'Y',
      tipoNomina: '',
      fechaLiquidacion: null,
      fechaInicio: null,
      fechaFin: null,
      totalEmpleadosPdf: 1,
      estado: 'completado',
      detalle: null,
      createdBy: 1,
    });
    await s.lotes.registrarError({ loteId: 1, empleadoRef: '123', mensaje: 'falló', rawBlock: null });
    const h = await s.historial.execute();
    expect(h.map((l) => l.id)).toEqual([2, 1]);
    expect(h[1].erroresDetalle).toEqual([{ id: 1, empleadoRef: '123', mensaje: 'falló' }]);
    expect(h[0].erroresDetalle).toEqual([]);
    expect(await new GetLoteUseCase(s.lotes).execute(1)).toMatchObject({
      id: 1,
      erroresDetalle: [{ empleadoRef: '123' }],
    });
    await expect(new GetLoteUseCase(s.lotes).execute(9)).rejects.toBeInstanceOf(NotFoundError);
  });
});
