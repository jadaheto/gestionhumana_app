import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import { NotFoundError } from '../../../../../shared/domain/domain-error';
import {
  GenerarCertificadoIngresosUseCase,
  GenerarCertificadoLaboralUseCase,
  GetContratosCertificablesUseCase,
  ListCertificadosUseCase,
} from '../../../application/use-cases/certificados.use-cases';
import {
  DeleteCuentaBancariaUseCase,
  ListCuentasBancariasUseCase,
  SaveCuentaBancariaUseCase,
} from '../../../application/use-cases/cuentas-bancarias.use-cases';
import {
  DescargarDesprendiblePdfUseCase,
  GetDesprendibleUseCase,
  GetReportesResumenUseCase,
  ListDesprendiblesUseCase,
} from '../../../application/use-cases/desprendibles.use-cases';
import { MiPuestoController } from '../mi-puesto.controller';

function providers() {
  const mock = (value: unknown = []) => ({ execute: jest.fn().mockResolvedValue(value) });
  const p = {
    listCuentas: mock([{ id: 1, banco: 'Bancolombia' }]),
    saveCuenta: mock({ id: 1, banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '123456' }),
    deleteCuenta: mock(undefined),
    listDesprendibles: mock([]),
    getDesprendible: { execute: jest.fn().mockRejectedValue(new NotFoundError('Desprendible', 9)) },
    descargar: mock({ filename: 'Desprendible_10.pdf', content: Buffer.from('%PDF-1.4 test') }),
    reportes: mock({ desprendibles: 0 }),
    listCertificados: mock([]),
    contratos: mock({ contratoActual: null, contratosVencidos: [] }),
    laboral: mock({ filename: 'Certificado_Laboral.pdf', content: Buffer.from('%PDF-1.4 cert') }),
    ingresos: mock({ filename: 'Certificado_Ingresos.pdf', content: Buffer.from('%PDF-1.4 ing') }),
  };
  return {
    p,
    list: [
      { provide: ListCuentasBancariasUseCase, useValue: p.listCuentas },
      { provide: SaveCuentaBancariaUseCase, useValue: p.saveCuenta },
      { provide: DeleteCuentaBancariaUseCase, useValue: p.deleteCuenta },
      { provide: ListDesprendiblesUseCase, useValue: p.listDesprendibles },
      { provide: GetDesprendibleUseCase, useValue: p.getDesprendible },
      { provide: DescargarDesprendiblePdfUseCase, useValue: p.descargar },
      { provide: GetReportesResumenUseCase, useValue: p.reportes },
      { provide: ListCertificadosUseCase, useValue: p.listCertificados },
      { provide: GetContratosCertificablesUseCase, useValue: p.contratos },
      { provide: GenerarCertificadoLaboralUseCase, useValue: p.laboral },
      { provide: GenerarCertificadoIngresosUseCase, useValue: p.ingresos },
    ],
  };
}

describe('MiPuestoController (HTTP)', () => {
  let app: INestApplication;
  let p: ReturnType<typeof providers>['p'];

  beforeAll(async () => {
    const pr = providers();
    p = pr.p;
    app = await createTestApp({ controllers: [MiPuestoController], providers: pr.list, actor: funcionarioActor });
  });
  afterAll(() => app.close());

  it('GET /mi-puesto/cuentas lista las cuentas del actor', async () => {
    await request(app.getHttpServer())
      .get('/mi-puesto/cuentas')
      .expect(200, [{ id: 1, banco: 'Bancolombia' }]);
    expect(p.listCuentas.execute).toHaveBeenCalledWith(funcionarioActor);
  });

  it('POST /mi-puesto/cuentas valida el cuerpo y pasa el actor', async () => {
    await request(app.getHttpServer())
      .post('/mi-puesto/cuentas')
      .send({ banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '123456' })
      .expect(201);
    expect(p.saveCuenta.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      input: { banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '123456' },
    });
    const res = await request(app.getHttpServer())
      .post('/mi-puesto/cuentas')
      .send({ banco: 'X', tipoCuenta: 'otra', numeroCuenta: '1' })
      .expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('PUT y DELETE /mi-puesto/cuentas/:id', async () => {
    await request(app.getHttpServer())
      .put('/mi-puesto/cuentas/7')
      .send({ banco: 'B', tipoCuenta: 'corriente', numeroCuenta: '999999' })
      .expect(200);
    expect(p.saveCuenta.execute).toHaveBeenLastCalledWith({
      actor: funcionarioActor,
      input: { banco: 'B', tipoCuenta: 'corriente', numeroCuenta: '999999', id: 7 },
    });
    await request(app.getHttpServer()).delete('/mi-puesto/cuentas/7').expect(204);
    expect(p.deleteCuenta.execute).toHaveBeenCalledWith({ actor: funcionarioActor, id: 7 });
  });

  it('GET /mi-puesto/desprendibles/:id traduce NotFoundError a 404', async () => {
    const res = await request(app.getHttpServer()).get('/mi-puesto/desprendibles/9').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('GET /mi-puesto/desprendibles/:id/pdf devuelve el PDF como adjunto', async () => {
    const res = await request(app.getHttpServer()).get('/mi-puesto/desprendibles/10/pdf').expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="Desprendible_10.pdf"');
    expect(Buffer.from(res.body as Buffer).toString()).toContain('%PDF-1.4 test');
    expect(p.descargar.execute).toHaveBeenCalledWith({ actor: funcionarioActor, id: 10 });
  });

  it('GET /mi-puesto/certificados filtra por tipo válido', async () => {
    await request(app.getHttpServer()).get('/mi-puesto/certificados?tipo=laboral').expect(200);
    expect(p.listCertificados.execute).toHaveBeenLastCalledWith({ actor: funcionarioActor, tipo: 'laboral' });
    await request(app.getHttpServer()).get('/mi-puesto/certificados?tipo=raro').expect(200);
    expect(p.listCertificados.execute).toHaveBeenLastCalledWith({ actor: funcionarioActor, tipo: undefined });
  });

  it('POST /mi-puesto/certificados/laboral genera el PDF y normaliza opcionales', async () => {
    const res = await request(app.getHttpServer())
      .post('/mi-puesto/certificados/laboral')
      .send({ modo: 'actual' })
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(p.laboral.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      input: { modo: 'actual', contratoId: null, incluirFunciones: false },
    });
    await request(app.getHttpServer())
      .post('/mi-puesto/certificados/laboral')
      .send({ modo: 'vencido', contratoId: 5, incluirFunciones: true })
      .expect(200);
    expect(p.laboral.execute).toHaveBeenLastCalledWith({
      actor: funcionarioActor,
      input: { modo: 'vencido', contratoId: 5, incluirFunciones: true },
    });
    await request(app.getHttpServer()).post('/mi-puesto/certificados/laboral').send({ modo: 'otro' }).expect(400);
  });

  it('POST /mi-puesto/certificados/ingresos exige un año válido', async () => {
    await request(app.getHttpServer()).post('/mi-puesto/certificados/ingresos').send({ anio: 2025 }).expect(200);
    expect(p.ingresos.execute).toHaveBeenCalledWith({ actor: funcionarioActor, input: { anio: 2025 } });
    await request(app.getHttpServer()).post('/mi-puesto/certificados/ingresos').send({ anio: 'abc' }).expect(400);
  });

  it('GET /mi-puesto/reportes y /certificados/laboral/contratos', async () => {
    await request(app.getHttpServer()).get('/mi-puesto/reportes').expect(200, { desprendibles: 0 });
    await request(app.getHttpServer())
      .get('/mi-puesto/certificados/laboral/contratos')
      .expect(200, { contratoActual: null, contratosVencidos: [] });
  });
});
