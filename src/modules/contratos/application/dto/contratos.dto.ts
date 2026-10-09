import { Actor } from '../../../../shared/domain/actor';

export interface ContratoDto {
  id: number;
  userId: number;
  colaboradorNombre: string;
  cedula: string | null;
  cargoNombre: string | null;
  areaNombre: string | null;
  tipoContrato: string;
  tipoContratoNombre: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  estado: string;
  /** Texto del legado: `finalizado` se muestra como "Inactivo". */
  estadoNombre: string;
  observaciones: string | null;
  /** Días hasta `fechaFin` (negativo si venció); null para contratos indefinidos. */
  diasParaVencer: number | null;
  puedeProrrogar: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GuardarContratoInput {
  id?: number;
  userId: number;
  tipoContrato: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  estado?: string | null;
  observaciones: string | null;
}

export interface RegistrarProrrogaInput {
  actor: Actor;
  contratoId: number;
  meses: number;
  observacion: string;
}

export interface ProrrogaRegistradaDto {
  contratoId: number;
  fechaFinAnterior: string;
  fechaFinNueva: string;
  meses: number;
}

export interface ProrrogaDto {
  id: number;
  contratoId: number;
  fechaFinAnterior: string;
  mesesProrroga: number;
  fechaInicioProrroga: string;
  fechaFinNueva: string;
  observacion: string | null;
  creadoPor: number;
  createdAt: string | null;
}

export interface ColaboradorDto {
  id: number;
  firstName: string;
  lastName: string;
  cedula: string | null;
  cargoNombre: string | null;
}

export const TIPOS_DOCUMENTO = ['preaviso', 'prorroga', 'renovacion'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Opciones del documento (paso 1 + paso 2 del asistente del legado). */
export interface GenerarDocumentoInput {
  contratoId: number;
  tipo: string;
  meses?: number | null;
  numero?: number | null;
  anios?: number | null;
  codigo?: string | null;
  firmanteNombre?: string | null;
  firmanteCargo?: string | null;
  revisoUno?: string | null;
  revisoDos?: string | null;
  proyecto?: string | null;
  /** Contenido del PNG de firma/sello subido (opcional). */
  firmaPng?: Buffer | null;
  firmaPngNombre?: string | null;
}

export interface DocumentoGeneradoDto {
  filename: string;
  mimeType: 'application/pdf';
  contenido: Buffer;
}
