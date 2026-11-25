import { Certificado, NuevoCertificado } from '../../../domain/certificado';
import { CuentaBancaria } from '../../../domain/cuenta-bancaria';
import { Desprendible } from '../../../domain/desprendible';
import {
  contadoresVacios,
  ContadoresLote,
  LotePrevioResumen,
  NominaImportError,
  NominaImportLote,
  NominaPreview,
  NuevoErrorImportacion,
  NuevoLote,
  ResultadoImportacionEmpleado,
} from '../../../domain/nomina-import';
import { NominaEmpleado, NominaMeta } from '../../../domain/nomina-parser';
import {
  CedulasExistentesReader,
  CertificadoConfig,
  CertificadoConfigReader,
  ContratoReader,
  ContratoResumen,
  NominaEmpleadoImporter,
  NominaImportSesion,
  PerfilColaborador,
  PerfilColaboradorReader,
  ProrrogaResumen,
} from '../../../domain/ports';
import {
  CertificadoRepository,
  CuentaBancariaRepository,
  DesprendibleRepository,
  FiltroTipoCertificado,
  NominaImportLoteRepository,
  NominaPreviewStore,
} from '../../../domain/repositories';
import { PdfDocumentSpec, PdfRenderer } from '../../ports/pdf-renderer.port';
import { PdfTextExtractor } from '../../ports/pdf-text-extractor.port';

export class InMemoryCuentaBancariaRepository extends CuentaBancariaRepository {
  items: CuentaBancaria[] = [];
  private seq = 1;
  findByUser(userId: number): Promise<CuentaBancaria[]> {
    return Promise.resolve(this.items.filter((c) => c.props.userId === userId));
  }
  findByIdAndUser(id: number, userId: number): Promise<CuentaBancaria | null> {
    return Promise.resolve(this.items.find((c) => c.id === id && c.props.userId === userId) ?? null);
  }
  save(cuenta: CuentaBancaria): Promise<CuentaBancaria> {
    if (cuenta.id) {
      this.items = this.items.map((c) => (c.id === cuenta.id ? cuenta : c));
      return Promise.resolve(cuenta);
    }
    const saved = cuenta.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
    return Promise.resolve();
  }
}

export function buildDesprendible(over: Partial<Desprendible> = {}): Desprendible {
  return {
    id: 10,
    userId: 2,
    periodo: '2026-04-16_2026-04-30_COLEGIO_T06',
    salarioBasico: 2_500_000,
    devengados: { 'Salario - 001': 1_250_000, 'Auxilio Transporte - 010': 100_000 },
    deducciones: {
      'Descuento Salud - 410': 54_000,
      'Descuento Pensión Colpensiones - 416': 54_000,
      'Retención Fuente': 10_000,
    },
    totalDevengado: 1_350_000,
    totalDeducido: 118_000,
    netoPagar: 1_232_000,
    fechaInicio: '2026-04-16',
    fechaFin: '2026-04-30',
    fechaLiquidacion: '2026-04-30',
    nroComprobante: '45871',
    banco: 'Bancolombia',
    numeroCuenta: '123456',
    archivoPdf: 'nomina/lote.pdf',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    ...over,
  };
}

export class InMemoryDesprendibleRepository extends DesprendibleRepository {
  items: Desprendible[] = [];
  findByUser(userId: number): Promise<Desprendible[]> {
    return Promise.resolve(
      this.items
        .filter((d) => d.userId === userId)
        .sort((a, b) => (b.fechaFin ?? '').localeCompare(a.fechaFin ?? '') || b.periodo.localeCompare(a.periodo)),
    );
  }
  findByIdAndUser(id: number, userId: number): Promise<Desprendible | null> {
    return Promise.resolve(this.items.find((d) => d.id === id && d.userId === userId) ?? null);
  }
}

export class InMemoryCertificadoRepository extends CertificadoRepository {
  items: Certificado[] = [];
  private seq = 1;
  findByUser(userId: number, tipo?: FiltroTipoCertificado): Promise<Certificado[]> {
    return Promise.resolve(
      this.items.filter(
        (c) => c.userId === userId && (!tipo || (tipo === 'laboral' ? c.tipo.includes('laboral') : c.tipo === tipo)),
      ),
    );
  }
  save(c: NuevoCertificado): Promise<Certificado> {
    const saved: Certificado = { ...c, id: this.seq++, createdAt: new Date() };
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}

export class InMemoryNominaImportLoteRepository extends NominaImportLoteRepository {
  lotes: NominaImportLote[] = [];
  errores: NominaImportError[] = [];
  private seq = 1;
  private errSeq = 1;

  create(l: NuevoLote): Promise<NominaImportLote> {
    const lote: NominaImportLote = {
      ...l,
      ...contadoresVacios(),
      id: this.seq++,
      createdAt: new Date('2026-10-08T10:00:00Z'),
    };
    this.lotes.push(lote);
    return Promise.resolve(lote);
  }
  findById(id: number): Promise<NominaImportLote | null> {
    return Promise.resolve(this.lotes.find((l) => l.id === id) ?? null);
  }
  findPrevioPorPeriodo(fechaInicio: string, fechaFin: string, fuente: string): Promise<LotePrevioResumen | null> {
    const found = [...this.lotes]
      .reverse()
      .find(
        (l) =>
          l.fechaInicio === fechaInicio &&
          l.fechaFin === fechaFin &&
          l.fuente === fuente &&
          ['completado', 'parcial'].includes(l.estado),
      );
    return Promise.resolve(found ? { id: found.id, estado: found.estado, createdAt: found.createdAt } : null);
  }
  incrementarContadores(id: number, inc: Partial<ContadoresLote>): Promise<ContadoresLote> {
    const l = this.lotes.find((x) => x.id === id)!;
    for (const k of Object.keys(contadoresVacios()) as Array<keyof ContadoresLote>) l[k] += inc[k] ?? 0;
    const {
      empleadosCreados,
      empleadosActualizados,
      desprendiblesCreados,
      desprendiblesActualizados,
      contratosActualizados,
      errores,
    } = l;
    return Promise.resolve({
      empleadosCreados,
      empleadosActualizados,
      desprendiblesCreados,
      desprendiblesActualizados,
      contratosActualizados,
      errores,
    });
  }
  actualizarEstado(id: number, estado: string, detalle: string | null): Promise<void> {
    const l = this.lotes.find((x) => x.id === id);
    if (l) {
      l.estado = estado;
      l.detalle = detalle;
    }
    return Promise.resolve();
  }
  cerrarAtascados(antesDe: Date, detalle: string): Promise<number> {
    let n = 0;
    for (const l of this.lotes) {
      if (l.estado === 'procesando' && l.createdAt < antesDe) {
        l.estado = 'error';
        l.detalle = detalle;
        n++;
      }
    }
    return Promise.resolve(n);
  }
  historial(limit: number): Promise<NominaImportLote[]> {
    return Promise.resolve([...this.lotes].sort((a, b) => b.id - a.id).slice(0, limit));
  }
  registrarError(e: NuevoErrorImportacion): Promise<void> {
    this.errores.push({ ...e, id: this.errSeq++, createdAt: new Date() });
    return Promise.resolve();
  }
  erroresDeLotes(loteIds: number[]): Promise<NominaImportError[]> {
    return Promise.resolve(this.errores.filter((e) => loteIds.includes(e.loteId)));
  }
}

export class InMemoryNominaPreviewStore extends NominaPreviewStore {
  items = new Map<string, NominaPreview>();
  private seq = 0;
  save(p: Omit<NominaPreview, 'token'>): Promise<NominaPreview> {
    const token = `${String(++this.seq).padStart(32, 'a')}`;
    const preview: NominaPreview = { ...p, token };
    this.items.set(token, preview);
    return Promise.resolve(preview);
  }
  get(token: string): Promise<NominaPreview | null> {
    return Promise.resolve(this.items.get(token) ?? null);
  }
  findByLoteId(loteId: number): Promise<NominaPreview | null> {
    return Promise.resolve([...this.items.values()].find((p) => p.loteId === loteId) ?? null);
  }
  update(token: string, cambios: Partial<Pick<NominaPreview, 'loteId' | 'procesados'>>): Promise<void> {
    const p = this.items.get(token);
    if (p) Object.assign(p, cambios);
    return Promise.resolve();
  }
  delete(token: string): Promise<void> {
    this.items.delete(token);
    return Promise.resolve();
  }
  purgar(antesDe: Date): Promise<number> {
    let n = 0;
    for (const [k, p] of this.items) {
      if (p.createdAt < antesDe) {
        this.items.delete(k);
        n++;
      }
    }
    return Promise.resolve(n);
  }
}

export class StubPerfilReader extends PerfilColaboradorReader {
  perfiles = new Map<number, PerfilColaborador>([
    [
      2,
      {
        id: 2,
        firstName: 'Juan',
        lastName: 'Pérez',
        cedula: '1102879310',
        cargoNombre: 'Docente Primaria',
        cargoFunciones: 'Dictar clases\nEvaluar estudiantes',
        areaNombre: 'Educación',
        sedeNombre: 'Colegio',
      },
    ],
  ]);
  getPerfil(userId: number): Promise<PerfilColaborador | null> {
    return Promise.resolve(this.perfiles.get(userId) ?? null);
  }
}

export function buildContrato(over: Partial<ContratoResumen> = {}): ContratoResumen {
  return {
    id: 100,
    userId: 2,
    tipoContrato: 'termino_fijo',
    numeroContrato: 'CT-100',
    fechaInicio: '2025-01-01',
    fechaFin: null,
    salarioBase: 2_500_000,
    estado: 'activo',
    ...over,
  };
}

export class StubContratoReader extends ContratoReader {
  actual: ContratoResumen | null = null;
  vencidos: ContratoResumen[] = [];
  prorrogasPorContrato = new Map<number, ProrrogaResumen[]>();
  contratoActual(): Promise<ContratoResumen | null> {
    return Promise.resolve(this.actual);
  }
  contratosVencidos(): Promise<ContratoResumen[]> {
    return Promise.resolve(this.vencidos);
  }
  contratoDeUsuario(contratoId: number, userId: number): Promise<ContratoResumen | null> {
    const todos = [this.actual, ...this.vencidos].filter((c): c is ContratoResumen => c !== null);
    return Promise.resolve(todos.find((c) => c.id === contratoId && c.userId === userId) ?? null);
  }
  prorrogas(contratoId: number): Promise<ProrrogaResumen[]> {
    return Promise.resolve(this.prorrogasPorContrato.get(contratoId) ?? []);
  }
}

export class StubCertificadoConfigReader extends CertificadoConfigReader {
  config: CertificadoConfig = {
    jefeNombre: 'María Gómez',
    jefeCargo: 'Jefe de Gestión Humana',
    firmaPath: null,
    logoPath: null,
  };
  get(): Promise<CertificadoConfig> {
    return Promise.resolve(this.config);
  }
}

export class StubCedulasReader extends CedulasExistentesReader {
  constructor(private readonly registradas: Set<string> = new Set()) {
    super();
  }
  existentes(variantes: string[]): Promise<Set<string>> {
    return Promise.resolve(new Set(variantes.filter((v) => this.registradas.has(v))));
  }
}

/** Importador falso: falla para las cédulas indicadas y registra las llamadas. */
export class FakeNominaEmpleadoImporter extends NominaEmpleadoImporter {
  llamadas: Array<{ emp: NominaEmpleado; meta: NominaMeta; archivo: string }> = [];
  fallan = new Set<string>();
  existentes = new Set<string>();
  sesiones = 0;
  iniciarSesion(): NominaImportSesion {
    this.sesiones++;
    return {
      importar: (emp, meta, archivo) => {
        this.llamadas.push({ emp, meta, archivo });
        if (this.fallan.has(emp.cedula)) return Promise.reject(new Error(`Fallo simulado para ${emp.cedula}`));
        const r: ResultadoImportacionEmpleado = {
          empleadoCreado: !this.existentes.has(emp.cedula),
          desprendibleCreado: true,
          contratoActualizado: this.existentes.has(emp.cedula),
        };
        return Promise.resolve(r);
      },
    };
  }
}

/** Renderizador falso: guarda las especificaciones y devuelve un buffer marcador. */
export class FakePdfRenderer extends PdfRenderer {
  specs: PdfDocumentSpec[] = [];
  render(spec: PdfDocumentSpec): Promise<Buffer> {
    this.specs.push(spec);
    return Promise.resolve(Buffer.from(`%PDF-fake ${spec.title}`));
  }
}

export class FakePdfTextExtractor extends PdfTextExtractor {
  constructor(public texto = '') {
    super();
  }
  extract(): Promise<string> {
    return Promise.resolve(this.texto);
  }
}

/** Texto plano de todos los bloques de un spec (para aserciones). */
export function textoDeSpec(spec: PdfDocumentSpec): string {
  return spec.blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
        case 'paragraph':
          return b.text;
        case 'keyValue':
          return b.rows.map(([k, v]) => `${k}: ${v}`).join('\n');
        case 'table':
          return [b.columns.map((c) => c.header).join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n');
        case 'list':
          return b.items.join('\n');
        case 'image':
          return `[imagen ${b.path}]`;
        case 'letterhead':
          return `${b.logoPath ? `[imagen ${b.logoPath}]\n` : ''}${b.text}`;
        case 'signature':
          return [b.imagePath ? `[imagen ${b.imagePath}]` : '', b.name, ...b.lines].filter(Boolean).join('\n');
        default:
          return '';
      }
    })
    .join('\n');
}
