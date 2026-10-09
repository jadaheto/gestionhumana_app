import { ConceptoInput, EstadoEvaluacion, NivelEndeudamiento } from '../../domain/endeudamiento-calculator';

export interface ConceptoDto {
  id: number | null;
  concepto: string;
  devengado: number;
  deducido: number;
  porcentaje: number;
  orden: number;
}

export interface SolicitudResumenDto {
  id: number;
  solicitudNo: string;
  userId: number;
  colaborador: string;
  cedula: string | null;
  fecha: string;
  porcentajeActual: number;
  porcentajeNuevoCredito: number;
  umbralAprobacion: number;
  estado: string;
  createdAt: string | null;
}

export interface SolicitudDetalleDto extends SolicitudResumenDto {
  anio: number | null;
  libranza: string | null;
  salarioMensual: number;
  otrosDevengados: number;
  totalDevengado: number;
  totalDeducido: number;
  netoActual: number;
  deduccionesLey: number;
  deduccionesEndeudamiento: number;
  valorSolicitado: number;
  plazoMeses: number;
  cuotaMensual: number;
  valorQuincenal: number;
  netoRecibir: number;
  opcionCredito: string | null;
  conclusion: string | null;
  conceptos: ConceptoDto[];
}

export interface ColaboradorBusquedaDto {
  id: number;
  nombre: string;
  cedula: string | null;
  codigo: string | null;
  /** Salario de referencia (contrato activo o tabla de cargos). */
  salario: number;
}

export interface SalarioReferenciaDto {
  userId: number;
  salario: number;
}

export interface SiguienteNumeroDto {
  solicitudNo: string;
}

export interface CrearSolicitudInput {
  userId: number;
  /** Si se omite o viene vacío se genera `SOL-<año>-####`. */
  solicitudNo?: string | null;
  fecha: string;
  libranza?: string | null;
  salarioMensual: number;
  otrosDevengados?: number;
  deduccionesLey?: number;
  umbralAprobacion?: number;
  conceptos: ConceptoInput[];
  valorSolicitado?: number;
  plazoMeses?: number;
  cuotaMensual?: number;
  opcionCredito?: string | null;
  conclusion?: string | null;
}

export type { EstadoEvaluacion, NivelEndeudamiento };
