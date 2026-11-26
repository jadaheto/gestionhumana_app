import { AsistenciaPolitica } from './asistencia-politica';
import { Marcacion, MarcacionImportada } from './marcacion';
import { EstadoAsistencia, RegistroAsistencia, ResumenConColaborador, ResumenDiario } from './resumen-diario';

// ---------- Repositorios propios del módulo ----------

export abstract class AsistenciaPoliticaRepository {
  abstract findBySede(sedeId: number): Promise<AsistenciaPolitica | null>;
  abstract save(politica: AsistenciaPolitica, updatedAt: Date): Promise<AsistenciaPolitica>;
}

export interface NuevaImportacion {
  sedeId: number;
  archivo: string;
  /** Usuario que cargó el archivo; null cuando viene de la base externa del reloj. */
  importadoPor: number | null;
  createdAt: Date;
  marcaciones: Array<MarcacionImportada & { userId: number | null }>;
}

export abstract class AsistenciaMarcacionRepository {
  /** Guarda la importación y sus marcaciones en una transacción; devuelve el id de la importación. */
  abstract saveImportacion(importacion: NuevaImportacion): Promise<number>;
  /** Marcaciones con colaborador resuelto de una sede en un día (`fecha` = `YYYY-MM-DD`). */
  abstract findBySedeYFecha(sedeId: number, fecha: string): Promise<Marcacion[]>;
  /** Claves `identificacion|YYYY-MM-DD HH:mm:ss` ya guardadas de una sede en un día (para no duplicar). */
  abstract findClavesBySedeYFecha(sedeId: number, fecha: string): Promise<Set<string>>;
}

/** Clave que identifica una marcación dentro de una sede. */
export function claveMarcacion(identificacion: string, fechaHora: string): string {
  return `${identificacion}|${fechaHora}`;
}

/**
 * Base de datos externa del reloj biométrico, con la estructura del reporte
 * "Asistencia Diaria" (Nro. de serie, Departamento, ID de usuario, Nombre,
 * Fecha/Hora, Tipo de registro, Operación, ...).
 */
export abstract class MarcacionesExternasReader {
  /** false cuando no está configurada (`ASISTENCIA_DB_HOST` vacío). */
  abstract habilitado(): boolean;
  /** Marcaciones válidas de un día (`YYYY-MM-DD`), de todas las sedes. */
  abstract leerDia(fecha: string): Promise<MarcacionImportada[]>;
}

export interface ResumenDiarioData {
  userId: number;
  sedeId: number;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  minutosTarde: number;
  minutosSalidaTemprana: number;
  estado: EstadoAsistencia;
  justificacion: string | null;
  detalle: string | null;
  updatedAt: Date;
}

export abstract class AsistenciaResumenRepository {
  abstract upsert(data: ResumenDiarioData): Promise<void>;
  abstract findByFechaYSede(fecha: string, sedeId: number): Promise<ResumenConColaborador[]>;
  /** Filas con tardanza cuyo memorando no se ha enviado y cuyo colaborador tiene correo. */
  abstract findTardePendientesMemo(fecha: string, sedeId: number): Promise<ResumenConColaborador[]>;
  abstract markMemo(id: number, ok: boolean, error: string | null, at: Date): Promise<void>;
  abstract findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<ResumenDiario[]>;
}

/** Tabla heredada `asistencia` (registros presencial/virtual). */
export abstract class AsistenciaRegistroRepository {
  abstract findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<RegistroAsistencia[]>;
}

// ---------- Puertos hacia otros contextos ----------

export interface ColaboradorAsistencia {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

/** Colaboradores (tabla `users`) de una sede: sólo activos y no administradores. */
export abstract class ColaboradoresSedeReader {
  abstract findActivosBySede(sedeId: number): Promise<ColaboradorAsistencia[]>;
  /** Resuelve el id del colaborador por cédula o código de empresa dentro de la sede. */
  abstract resolveUserId(identificacion: string, sedeId: number): Promise<number | null>;
}

/** Permisos/vacaciones aprobados o incapacidades vigentes que justifican la ausencia. */
export abstract class JustificacionReader {
  /** Devuelve el texto de justificación del día o cadena vacía. */
  abstract justificacionDia(userId: number, fecha: string): Promise<string>;
}

export interface SedeOption {
  id: number;
  nombre: string;
}

export abstract class SedesReader {
  abstract listActivas(): Promise<SedeOption[]>;
}
