import { InvalidOperationError, ValidationError } from '../../../../../shared/domain/domain-error';
import { FakeClock, funcionarioActor } from '../../../../../shared/testing/fakes';
import { cedulaConPuntos, fechaExpedicionEnLetras, numeroALetras, pesosEnLetras } from '../../formato';
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
    expect(texto).toContain('LA JEFE DE GESTIÓN HUMANA DE LA CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE “COMFASUCRE”');
    expect(texto).toContain('NIT: 892200015-5');
    expect(texto).toContain('CERTIFICA');
    expect(texto).toContain(
      'Que el(la) señor(a) JUAN PÉREZ, identificado(a) con cédula de ciudadanía No. 1.102.879.310, labora en esta empresa mediante Contrato Individual de Trabajo a término fijo desde el día 1 de enero de 2025 hasta el día 31 de diciembre de 2026, actualmente desempeña el cargo de DOCENTE PRIMARIA, en el área de Educación, con una asignación salarial mensual de DOS MILLONES QUINIENTOS MIL PESOS M/CTE ($2.500.000).',
    );
    expect(texto).toContain('Prórroga por 6 mes(es), desde el 1 de julio de 2026 hasta el 31 de diciembre de 2026.');
    expect(texto).toContain(
      'Se expide esta certificación a solicitud de la parte interesada en Sincelejo, a los ocho (8) días del mes de octubre de 2026.',
    );
    expect(texto).toContain('[imagen /abs/firma.png]');
    expect(texto).toContain('MARÍA GÓMEZ');
    expect(pdf.specs[0].footer?.columns.flat()).toContain('www.comfasucre.com.co');
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
    expect(texto).toContain('Funciones del cargo de DOCENTE PRIMARIA');
    expect(texto).toContain('Dictar clases');
    expect(texto).toContain('desde el día 1 de enero de 2025, actualmente desempeña');
    expect(certificados.items[0].tipo).toBe('laboral_con_funciones');
  });

  it('modo historico: incluye el vigente y los vencidos', async () => {
    contratos.actual = buildContrato({ id: 100 });
    contratos.vencidos = [
      buildContrato({ id: 90, fechaInicio: '2023-01-01', fechaFin: '2024-12-31', tipoContrato: 'obra_labor' }),
    ];
    await uc.execute({ actor: funcionarioActor, input: { modo: 'historico', incluirFunciones: false } });
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('registra en esta empresa las siguientes vinculaciones');
    expect(texto).toContain(
      'Contrato Individual de Trabajo por obra o labor desde el 1 de enero de 2023 hasta el 31 de diciembre de 2024, con una asignación salarial mensual de $2.500.000.',
    );
    expect(texto).toContain('a la fecha (vigente)');
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
    expect(textoDeSpec(pdf.specs[0])).toContain('laboró en esta empresa mediante');
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

describe('Formato en letras', () => {
  it('escribe valores y fechas como en un certificado', () => {
    expect(pesosEnLetras(6061275)).toBe(
      'SEIS MILLONES SESENTA Y UN MIL DOSCIENTOS SETENTA Y CINCO PESOS M/CTE ($6.061.275)',
    );
    expect(pesosEnLetras(1000000)).toBe('UN MILLÓN DE PESOS M/CTE ($1.000.000)');
    expect(pesosEnLetras(1423500)).toBe('UN MILLÓN CUATROCIENTOS VEINTITRÉS MIL QUINIENTOS PESOS M/CTE ($1.423.500)');
    expect(numeroALetras(21, true)).toBe('veintiún');
    expect(numeroALetras(100)).toBe('cien');
    expect(numeroALetras(1001)).toBe('mil uno');
    expect(fechaExpedicionEnLetras(new Date(2026, 5, 1))).toBe('al primer (1) día del mes de junio de 2026');
    expect(fechaExpedicionEnLetras(new Date(2026, 4, 31))).toBe('a los treinta y un (31) días del mes de mayo de 2026');
    expect(cedulaConPuntos('1101814261')).toBe('1.101.814.261');
    expect(cedulaConPuntos('AB-123')).toBe('AB-123');
  });
});
