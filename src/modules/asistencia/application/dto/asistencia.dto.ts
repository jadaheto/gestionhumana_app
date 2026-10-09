import { EstadoAsistencia } from '../../domain/resumen-diario';

export interface PoliticaAsistenciaDto {
  sedeId: number;
  horaEntradaLimite: string;
  horaSalidaTemprana: string;
  toleranciaMinutos: number;
  enviarMemorandoTardanza: boolean;
  /** `false` cuando la sede aún no tiene política guardada (se muestran los valores por defecto). */
  configurada: boolean;
}

export interface ResumenDiarioDto {
  id: number;
  userId: number;
  colaborador: string;
  cedula: string | null;
  email: string | null;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  minutosTarde: number;
  minutosSalidaTemprana: number;
  estado: EstadoAsistencia;
  detalle: string;
  justificacion: string | null;
  memoEnviado: boolean;
  memoEnviadoAt: string | null;
  memoError: string | null;
}

export interface ResumenAsistenciaDto {
  fecha: string;
  sedeId: number;
  politica: PoliticaAsistenciaDto;
  resumen: ResumenDiarioDto[];
}

export interface SedeAsistenciaDto {
  id: number;
  nombre: string;
}

export interface ImportacionResultadoDto {
  importacionId: number;
  totalFilas: number;
  /** Marcaciones cuya identificación no coincide con ningún colaborador de la sede. */
  sinColaborador: number;
  mensaje: string;
}

export interface MemorandosResultadoDto {
  enviados: number;
  fallidos: number;
  mensaje: string;
}

export interface HistorialAsistenciaDto {
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  /** `presencial`/`virtual` (tabla `asistencia`) o `biometrico` (resumen diario). */
  tipo: string;
  estado: EstadoAsistencia | null;
  observacion: string;
}

export interface SavePoliticaInput {
  sedeId: number;
  horaEntradaLimite: string;
  horaSalidaTemprana: string;
  toleranciaMinutos: number;
  enviarMemorandoTardanza: boolean;
}
