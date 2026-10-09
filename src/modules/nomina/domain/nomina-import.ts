import { NotFoundError } from '../../../shared/domain/domain-error';
import { NominaEmpleado, NominaMeta, NominaParseResult } from './nomina-parser';

export const ESTADOS_LOTE = ['pendiente', 'procesando', 'completado', 'parcial', 'error'] as const;
export type EstadoLote = (typeof ESTADOS_LOTE)[number];

/** Fuentes de nómina que ofrece el selector del legado (además de la autodetección). */
export const FUENTES_NOMINA = ['COLEGIO', 'CAMPANOS', 'COMFASUCRE'] as const;

/** Tamaño de tanda por llamada a "procesar" (igual que el legado). */
export const TAMANO_TANDA_DEFECTO = 5;
export const TAMANO_TANDA_MAXIMO = 50;

/** Minutos tras los cuales un lote en "procesando" se considera atascado. */
export const MINUTOS_LOTE_ATASCADO = 30;

/** Horas de vida de una vista previa no confirmada. */
export const HORAS_VIDA_PREVIEW = 24;

export interface ContadoresLote {
  empleadosCreados: number;
  empleadosActualizados: number;
  desprendiblesCreados: number;
  desprendiblesActualizados: number;
  contratosActualizados: number;
  errores: number;
}

export function contadoresVacios(): ContadoresLote {
  return {
    empleadosCreados: 0,
    empleadosActualizados: 0,
    desprendiblesCreados: 0,
    desprendiblesActualizados: 0,
    contratosActualizados: 0,
    errores: 0,
  };
}

/** Lote de importación (tabla `nomina_import_lotes`). */
export interface NominaImportLote extends ContadoresLote {
  id: number;
  archivo: string;
  archivoOriginal: string | null;
  fuente: string;
  tipoNomina: string;
  fechaLiquidacion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  totalEmpleadosPdf: number;
  estado: string; // EstadoLote; la columna no tiene CHECK
  detalle: string | null;
  createdBy: number | null;
  createdByNombre?: string | null;
  createdAt: Date;
}

export type NuevoLote = Omit<NominaImportLote, 'id' | 'createdAt' | 'createdByNombre' | keyof ContadoresLote>;

/** Error por empleado dentro de un lote (tabla `nomina_import_errores`). */
export interface NominaImportError {
  id: number;
  loteId: number;
  empleadoRef: string;
  mensaje: string;
  rawBlock: string | null;
  createdAt: Date;
}

export type NuevoErrorImportacion = Omit<NominaImportError, 'id' | 'createdAt'>;

/** Empleado parseado enriquecido con la existencia en el sistema. */
export interface NominaEmpleadoPreview extends NominaEmpleado {
  existe: boolean;
}

export interface NominaParsePreview extends Omit<NominaParseResult, 'empleados'> {
  empleados: NominaEmpleadoPreview[];
}

/** Resumen del lote previo del mismo período (si existe). */
export interface LotePrevioResumen {
  id: number;
  estado: string;
  createdAt: Date;
}

/**
 * Vista previa temporal entre la fase 1 (parseo) y la fase 2 (importación).
 * Equivale al `preview_<token>.json` del legado.
 */
export interface NominaPreview {
  token: string;
  parsed: NominaParsePreview;
  /** Ruta relativa del PDF en el almacenamiento (`nomina/xxx.pdf`). */
  archivo: string;
  archivoOriginal: string;
  nuevos: number;
  existentes: number;
  lotePrevio: LotePrevioResumen | null;
  /** Lote creado al confirmar; null mientras sólo es vista previa. */
  loteId: number | null;
  /** Empleados ya procesados (para reanudar sin repetir). */
  procesados: number;
  createdBy: number;
  createdAt: Date;
}

export interface ResultadoImportacionEmpleado {
  empleadoCreado: boolean;
  desprendibleCreado: boolean;
  contratoActualizado: boolean;
}

// ------------------------------------------------------------------
// Reglas puras reutilizadas por la importación (port de AdminUsuarios.php)
// ------------------------------------------------------------------

/** Deja sólo caracteres alfanuméricos (igual que `preg_replace('/[^0-9A-Za-z]/', '', …)`). */
export function normalizarCedula(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/[^0-9A-Za-z]/g, '');
}

/** Variantes normalizadas de la cédula (limpia y con dígito de verificación). */
export function variantesCedula(emp: Pick<NominaEmpleado, 'cedula' | 'cedulaRaw'>): string[] {
  const v = [normalizarCedula(emp.cedula), normalizarCedula(emp.cedulaRaw || emp.cedula)].filter((x) => x !== '');
  return Array.from(new Set(v));
}

/** Identificación útil del empleado para crear el usuario. */
export function cedulaUtil(emp: Pick<NominaEmpleado, 'cedula' | 'documentoNomina'>): string {
  return (emp.cedula || emp.documentoNomina || '').trim();
}

/** Referencia del empleado para la tabla de errores. */
export function referenciaEmpleado(emp: Pick<NominaEmpleado, 'cedula' | 'documentoNomina' | 'nombre'>): string {
  return emp.cedula || emp.documentoNomina || emp.nombre;
}

/** Divide "NOMBRE APELLIDO1 APELLIDO2" en first/last como el legado. */
export function dividirNombre(nombreCompleto: string): { firstName: string; lastName: string } {
  const parts = String(nombreCompleto ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  const firstName = parts[0] ?? 'FUNCIONARIO';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'NOMINA';
  return { firstName, lastName };
}

/** Base para username/correo técnico del usuario creado desde nómina. */
export function baseLocalUsuario(
  emp: Pick<NominaEmpleado, 'documentoNomina'>,
  cedulaNorm: string,
  firstName: string,
  lastName: string,
  ahora: Date,
): string {
  const soloAlnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let base = soloAlnum(cedulaNorm);
  if (base === '') base = soloAlnum(emp.documentoNomina ?? '');
  if (base === '') base = soloAlnum(firstName + lastName);
  if (base === '') {
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mm = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');
    base = `nomina${hh}${mm}${ss}`;
  }
  return base;
}

/** Clave de período del desprendible: "2026-04-16_2026-04-30_COLEGIO_T06". */
export function buildPeriodoKey(meta: NominaMeta): string {
  const ini = meta.fechaInicio || '0000-00-00';
  const fin = meta.fechaFin || '0000-00-00';
  const src = (meta.fuente || 'GENERAL').trim().toUpperCase();
  const tipo = (meta.tipoNomina || 'NA').trim();
  return `${ini}_${fin}_${src}_T${tipo}`;
}

/** Nombres por defecto de sede/área/cargo cuando el PDF no los trae. */
export function nombresOrganizacion(emp: Pick<NominaEmpleado, 'area' | 'cargo'>, meta: Pick<NominaMeta, 'fuente'>) {
  return {
    sede: (meta.fuente || 'COLEGIO').trim() || 'COLEGIO',
    area: (emp.area || 'EDUCACION').trim() || 'EDUCACION',
    cargo: (emp.cargo || 'SIN CARGO').trim() || 'SIN CARGO',
  };
}

export function totalesEmpleado(emp: Pick<NominaEmpleado, 'devengados' | 'deducciones'>): {
  totalDevengado: number;
  totalDeducido: number;
} {
  const suma = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + Number(b || 0), 0);
  return { totalDevengado: suma(emp.devengados ?? {}), totalDeducido: suma(emp.deducciones ?? {}) };
}

/** Estado final de un lote según sus errores. */
export function estadoFinalLote(errores: number): EstadoLote {
  return errores > 0 ? 'parcial' : 'completado';
}

/** Mensaje de cierre de importación (mismo texto que el legado). */
export function mensajeResumenLote(estado: string, c: ContadoresLote): string {
  return (
    `Importación finalizada (${estado}). Empleados nuevos: ${c.empleadosCreados}, actualizados: ${c.empleadosActualizados}. ` +
    `Desprendibles nuevos: ${c.desprendiblesCreados}, actualizados: ${c.desprendiblesActualizados}. ` +
    `Contratos con salario actualizado: ${c.contratosActualizados}. Errores: ${c.errores}.`
  );
}

// ------------------------------------------------------------------
// Errores específicos
// ------------------------------------------------------------------

/** La vista previa no existe, expiró o ya fue consumida. → HTTP 404 */
export class PreviewExpiradaError extends NotFoundError {
  constructor() {
    super('Vista previa');
    this.message = 'La vista previa expiró o ya fue procesada. Vuelve a subir el PDF.';
  }
}
