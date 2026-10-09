import { NotFoundError } from '../../../../../shared/domain/domain-error';
import { FakeClock, funcionarioActor } from '../../../../../shared/testing/fakes';
import { CuentaBancaria } from '../../../domain/cuenta-bancaria';
import {
  DescargarDesprendiblePdfUseCase,
  GetDesprendibleUseCase,
  GetReportesResumenUseCase,
  ListDesprendiblesUseCase,
} from '../desprendibles.use-cases';
import {
  buildDesprendible,
  FakePdfRenderer,
  InMemoryCertificadoRepository,
  InMemoryCuentaBancariaRepository,
  InMemoryDesprendibleRepository,
  StubCertificadoConfigReader,
  StubPerfilReader,
  textoDeSpec,
} from './in-memory-nomina.repositories';

describe('Desprendibles (casos de uso)', () => {
  let repo: InMemoryDesprendibleRepository;
  beforeEach(() => {
    repo = new InMemoryDesprendibleRepository();
    repo.items.push(
      buildDesprendible({ id: 10, fechaFin: '2026-04-30' }),
      buildDesprendible({
        id: 11,
        fechaFin: '2026-05-15',
        fechaInicio: '2026-05-01',
        periodo: '2026-05-01_2026-05-15_COLEGIO_T06',
        nroComprobante: null,
      }),
      buildDesprendible({ id: 12, userId: 1 }),
    );
  });

  it('lista los desprendibles propios, más recientes primero, con comprobante por defecto', async () => {
    const lista = await new ListDesprendiblesUseCase(repo).execute(funcionarioActor);
    expect(lista.map((d) => d.id)).toEqual([11, 10]);
    expect(lista[0].nroComprobante).toBe('NOM-11');
    expect(lista[1].nroComprobante).toBe('45871');
  });

  it('devuelve el detalle con conceptos y rechaza desprendibles de otros usuarios', async () => {
    const uc = new GetDesprendibleUseCase(repo);
    const d = await uc.execute({ actor: funcionarioActor, id: 10 });
    expect(d.devengados['Salario - 001']).toBe(1_250_000);
    await expect(uc.execute({ actor: funcionarioActor, id: 12 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('genera el comprobante de pago en PDF con los datos del legado', async () => {
    const pdf = new FakePdfRenderer();
    const config = new StubCertificadoConfigReader();
    config.config.logoPath = '/abs/logo.png';
    const uc = new DescargarDesprendiblePdfUseCase(repo, new StubPerfilReader(), config, pdf, new FakeClock());
    const archivo = await uc.execute({ actor: funcionarioActor, id: 10 });
    expect(archivo.filename).toBe('Desprendible_10.pdf');
    expect(archivo.content.toString()).toContain('%PDF');
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('COMPROBANTE DE PAGO');
    expect(texto).toContain('[imagen /abs/logo.png]');
    expect(texto).toContain('No. Comprobante: 45871');
    expect(texto).toContain('Periodo: 16/04/2026 a 30/04/2026');
    expect(texto).toContain('Empleado: Juan Pérez');
    expect(texto).toContain('ID: 1102879310');
    expect(texto).toContain('Cargo: Docente Primaria');
    expect(texto).toContain('Departamento: Educación');
    expect(texto).toContain('Banco/Cuenta: Bancolombia 123456');
    expect(texto).toContain('Salario - 001 | 1.250.000 | 0');
    expect(texto).toContain('Descuento Salud - 410 | 0 | 54.000');
    expect(texto).toContain('NETO A PAGAR: $ 1.232.000');
  });

  it('usa una fila "Salario" cuando el desprendible no tiene conceptos', async () => {
    repo.items.push(buildDesprendible({ id: 20, devengados: {}, deducciones: {}, fechaLiquidacion: null }));
    const pdf = new FakePdfRenderer();
    const uc = new DescargarDesprendiblePdfUseCase(
      repo,
      new StubPerfilReader(),
      new StubCertificadoConfigReader(),
      pdf,
      new FakeClock(),
    );
    await uc.execute({ actor: funcionarioActor, id: 20 });
    const texto = textoDeSpec(pdf.specs[0]);
    expect(texto).toContain('Salario | 1.350.000 | 118.000');
    expect(texto).toContain('Fecha liquidación: 08/10/2026');
  });

  it('resume los reportes del colaborador', async () => {
    const certs = new InMemoryCertificadoRepository();
    await certs.save({
      userId: 2,
      tipo: 'laboral_sin_funciones',
      fechaGeneracion: '2026-01-01',
      archivoPdf: null,
      generadoPor: 2,
      datos: {},
    });
    const cuentas = new InMemoryCuentaBancariaRepository();
    await cuentas.save(CuentaBancaria.create({ userId: 2, banco: 'B', tipoCuenta: 'ahorros', numeroCuenta: '111111' }));
    const resumen = await new GetReportesResumenUseCase(repo, certs, cuentas, new FakeClock()).execute(
      funcionarioActor,
    );
    expect(resumen).toEqual({
      desprendibles: 2,
      ultimoPeriodo: { fechaInicio: '2026-05-01', fechaFin: '2026-05-15', netoPagar: 1_232_000 },
      totalNetoAnioActual: 2_464_000,
      certificados: 1,
      cuentasBancarias: 1,
    });
  });
});
