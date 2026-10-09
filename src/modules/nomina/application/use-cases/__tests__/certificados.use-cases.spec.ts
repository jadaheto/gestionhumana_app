import { InvalidOperationError, ValidationError } from '../../../../../shared/domain/domain-error';
import { FakeClock, funcionarioActor } from '../../../../../shared/testing/fakes';
import {
  GenerarCertificadoIngresosUseCase,
  GenerarCertificadoLaboralUseCase,
  GetContratosCertificablesUseCase,
  ListCertificadosUseCase,
} from '../certificados.use-cases';
import {
  buildContrato,
  buildDesprendible,
  FakePdfRenderer,
  InMemoryCertificadoRepository,
  InMemoryDesprendibleRepository,
  StubCertificadoConfigReader,
  StubContratoReader,
  StubPerfilReader,
  textoDeSpec,
} from './in-memory-nomina.repositories';

describe('Certificado laboral', () => {
  let contratos: StubContratoReader;
  let certificados: InMemoryCertificadoRepository;
  let pdf: FakePdfRenderer;
  let config: StubCertificadoConfigReader;
  let uc: GenerarCertificadoLaboralUseCase;

  beforeEach(() => {
    contratos = new StubContratoReader();
    certificados = new InMemoryCertificadoRepository();
    pdf = new FakePdfRenderer();
    config = new StubCertificadoConfigReader();
    uc = new GenerarCertificadoLaboralUseCase(
      new StubPerfilReader(),
      contratos,
      certificados,
      config,
      pdf,
      new FakeClock(),
    );
  });

  it('modo actual: certifica el contrato vigente, sus prórrogas y usa la configuración del firmante', async () => {
    contratos.actual = buildContrato({ fechaFin: '2026-12-31' });
    contratos.prorrogasPorContrato.set(100, [
      { id: 1, mesesProrroga: 6, fechaInicioProrroga: '2026-07-01', fechaFinNueva: '2026-12-31' },
    ]);
    config.config.firmaPath = '/abs/firma.png';

    const archivo = await uc.execute({ actor: funcionarioActor, input: { modo: 'actual', incluirFunciones: false } });

    expect(archivo.filename).toMatch(/^Certificado_Laboral_2_20261008_\d{6}\.pdf$/);
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('CERTIFICACIÓN LABORAL');
    expect(texto).toContain('La suscrita Jefe de Gestión Humana de la Caja de Compensación Familiar de Sucre');
    expect(texto).toContain('El(la) señor(a) Juan Pérez, identificado(a) con cédula No. 1102879310');
    expect(texto).toContain(
      'Contrato Termino fijo desde 01/01/2025 hasta 31/12/2026, desempeñando el cargo de Docente Primaria con salario mensual de $2.500.000.',
    );
    expect(texto).toContain('Prórroga por 6 mes(es), desde 01/07/2026 hasta 31/12/2026.');
    expect(texto).toContain('[imagen /abs/firma.png]');
    expect(texto).toContain('María Gómez');
    expect(texto).not.toContain('Funciones del cargo');
    expect(certificados.items[0]).toMatchObject({
      userId: 2,
      tipo: 'laboral_sin_funciones',
      fechaGeneracion: '2026-10-08',
      datos: { modo: 'actual', contratos: [100] },
    });
  });

  it('con funciones: añade las funciones del cargo y registra laboral_con_funciones', async () => {
    contratos.actual = buildContrato();
    await uc.execute({ actor: funcionarioActor, input: { modo: 'actual', incluirFunciones: true } });
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('Funciones del cargo de Docente Primaria');
    expect(texto).toContain('Dictar clases');
    expect(texto).toContain('hasta Vigente');
    expect(certificados.items[0].tipo).toBe('laboral_con_funciones');
  });

  it('modo historico: incluye el vigente y los vencidos', async () => {
    contratos.actual = buildContrato({ id: 100 });
    contratos.vencidos = [
      buildContrato({ id: 90, fechaInicio: '2023-01-01', fechaFin: '2024-12-31', tipoContrato: 'obra_labor' }),
    ];
    await uc.execute({ actor: funcionarioActor, input: { modo: 'historico', incluirFunciones: false } });
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('Contrato Obra labor desde 01/01/2023 hasta 31/12/2024');
    expect(certificados.items[0].datos).toMatchObject({ contratos: [100, 90] });
  });

  it('modo vencido: exige contratoId y que el contrato esté realmente vencido', async () => {
    contratos.actual = buildContrato({ id: 100 });
    contratos.vencidos = [buildContrato({ id: 90, fechaFin: '2024-12-31' })];
    await expect(
      uc.execute({ actor: funcionarioActor, input: { modo: 'vencido', incluirFunciones: false } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      uc.execute({ actor: funcionarioActor, input: { modo: 'vencido', contratoId: 100, incluirFunciones: false } }),
    ).rejects.toBeInstanceOf(InvalidOperationError);
    await uc.execute({ actor: funcionarioActor, input: { modo: 'vencido', contratoId: 90, incluirFunciones: false } });
    expect(certificados.items[0].datos).toMatchObject({ modo: 'vencido', contratos: [90] });
  });

  it('falla con mensaje del legado cuando no hay contratos', async () => {
    await expect(
      uc.execute({ actor: funcionarioActor, input: { modo: 'actual', incluirFunciones: false } }),
    ).rejects.toThrow('No se encontraron contratos para generar la certificación.');
    expect(certificados.items).toHaveLength(0);
  });

  it('expone el resumen contractual y el historial de certificados', async () => {
    contratos.actual = buildContrato();
    contratos.vencidos = [buildContrato({ id: 90 })];
    expect(await new GetContratosCertificablesUseCase(contratos).execute(funcionarioActor)).toEqual({
      contratoActual: contratos.actual,
      contratosVencidos: contratos.vencidos,
    });
    await certificados.save({
      userId: 2,
      tipo: 'laboral_con_funciones',
      fechaGeneracion: '2026-01-01',
      archivoPdf: null,
      generadoPor: 2,
      datos: {},
    });
    await certificados.save({
      userId: 2,
      tipo: 'ingresos_retenciones',
      fechaGeneracion: '2026-01-01',
      archivoPdf: null,
      generadoPor: 2,
      datos: {},
    });
    const list = new ListCertificadosUseCase(certificados);
    expect((await list.execute({ actor: funcionarioActor, tipo: 'laboral' })).map((c) => c.tipo)).toEqual([
      'laboral_con_funciones',
    ]);
    expect((await list.execute({ actor: funcionarioActor })).length).toBe(2);
  });
});

describe('Certificado de ingresos y retenciones', () => {
  let desprendibles: InMemoryDesprendibleRepository;
  let certificados: InMemoryCertificadoRepository;
  let pdf: FakePdfRenderer;
  let uc: GenerarCertificadoIngresosUseCase;

  beforeEach(() => {
    desprendibles = new InMemoryDesprendibleRepository();
    certificados = new InMemoryCertificadoRepository();
    pdf = new FakePdfRenderer();
    uc = new GenerarCertificadoIngresosUseCase(
      new StubPerfilReader(),
      desprendibles,
      certificados,
      new StubCertificadoConfigReader(),
      pdf,
      new FakeClock(),
    );
  });

  it('acumula los conceptos del año, separa salud/pensión/retención y registra el certificado', async () => {
    desprendibles.items.push(
      buildDesprendible({ id: 1, fechaFin: '2025-01-15', fechaInicio: '2025-01-01' }),
      buildDesprendible({ id: 2, fechaFin: '2025-01-31', fechaInicio: '2025-01-16' }),
      buildDesprendible({ id: 3, fechaFin: '2026-01-15', fechaInicio: '2026-01-01' }),
    );
    const archivo = await uc.execute({ actor: funcionarioActor, input: { anio: 2025 } });
    expect(archivo.filename).toMatch(/^Certificado_Ingresos_2025_2_/);
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('Año gravable 2025');
    expect(texto).toContain('Salario - 001 | $ 2.500.000');
    expect(texto).toContain('TOTAL INGRESOS | $ 2.700.000');
    expect(texto).toContain('Aportes obligatorios a salud: $ 108.000');
    expect(texto).toContain('Aportes obligatorios a pensión: $ 108.000');
    expect(texto).toContain('Retención en la fuente practicada: $ 20.000');
    expect(certificados.items[0]).toMatchObject({
      tipo: 'ingresos_retenciones',
      datos: { anio: 2025, desprendibles: [2, 1], totalDevengado: 2_700_000, retencion: 20_000 },
    });
  });

  it('rechaza años inválidos o sin desprendibles', async () => {
    await expect(uc.execute({ actor: funcionarioActor, input: { anio: 2030 } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(uc.execute({ actor: funcionarioActor, input: { anio: 2025 } })).rejects.toThrow(
      'No hay desprendibles de nómina registrados para el año 2025.',
    );
  });
});
