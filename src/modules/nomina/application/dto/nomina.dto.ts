import { ConceptosNomina } from '../../domain/desprendible';
import { ContadoresLote, LotePrevioResumen, NominaParsePreview } from '../../domain/nomina-import';
import { ModoCertificadoLaboral } from '../../domain/certificado';
import { ContratoResumen } from '../../domain/ports';

// ---------- Cuentas bancarias ----------
export interface CuentaBancariaDto {
  id: number;
  banco: string;
  tipoCuenta: string; // TipoCuenta; la columna no tiene CHECK
  numeroCuenta: string;
  createdAt: Date | null;
}
export interface SaveCuentaInput {
  id?: number;
  /** Colaborador dueño de la cuenta (por defecto, el propio administrador). */
  userId?: number;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
}

// ---------- Desprendibles ----------
export interface DesprendibleResumenDto {
  id: number;
  periodo: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaLiquidacion: string | null;
  nroComprobante: string;
  salarioBasico: number;
  totalDevengado: number;
  totalDeducido: number;
  netoPagar: number;
}
export interface DesprendibleDetalleDto extends DesprendibleResumenDto {
  devengados: ConceptosNomina;
  deducciones: ConceptosNomina;
  banco: string | null;
  numeroCuenta: string | null;
}

/** Archivo generado listo para enviar al cliente. */
export interface ArchivoPdfDto {
  filename: string;
  content: Buffer;
}

// ---------- Reportes ----------
export interface ReportesResumenDto {
  desprendibles: number;
  ultimoPeriodo: { fechaInicio: string | null; fechaFin: string | null; netoPagar: number } | null;
  totalNetoAnioActual: number;
  certificados: number;
  cuentasBancarias: number;
}

// ---------- Certificados ----------
export interface CertificadoDto {
  id: number;
  tipo: string;
  fechaGeneracion: string;
  datos: Record<string, unknown>;
  createdAt: Date | null;
}
export interface ContratosCertificablesDto {
  contratoActual: ContratoResumen | null;
  contratosVencidos: ContratoResumen[];
}
export interface GenerarCertificadoLaboralInput {
  modo: ModoCertificadoLaboral;
  contratoId?: number | null;
  incluirFunciones: boolean;
}
export interface GenerarCertificadoIngresosInput {
  anio: number;
}

// ---------- Importación de nómina ----------
export interface NominaPreviewDto {
  token: string;
  archivoOriginal: string;
  parsed: NominaParsePreview;
  nuevos: number;
  existentes: number;
  lotePrevio: LotePrevioResumen | null;
  loteId: number | null;
  procesados: number;
}
export interface ConfirmarImportacionDto {
  loteId: number;
  total: number;
}
export interface ProgresoLoteDto {
  loteId: number;
  processed: number;
  total: number;
  done: boolean;
  estado: string;
  counts: ContadoresLote;
}
export interface LoteDto extends ContadoresLote {
  id: number;
  archivo: string;
  archivoOriginal: string | null;
  fuente: string;
  tipoNomina: string;
  fechaLiquidacion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  totalEmpleadosPdf: number;
  estado: string;
  detalle: string | null;
  createdByNombre: string | null;
  createdAt: Date;
  erroresDetalle: Array<{ id: number; empleadoRef: string; mensaje: string }>;
}
