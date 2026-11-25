import { NominaEmpleado, NominaMeta } from './nomina-parser';
import { ResultadoImportacionEmpleado } from './nomina-import';

/** Datos del colaborador necesarios para desprendibles y certificados (contexto Usuarios/Organización). */
export interface PerfilColaborador {
  id: number;
  firstName: string;
  lastName: string;
  cedula: string | null;
  /** `masculino` | `femenino` | `otro` | null: define el tratamiento en el certificado. */
  genero?: string | null;
  cargoNombre: string | null;
  cargoFunciones: string | null;
  areaNombre: string | null;
  sedeNombre: string | null;
}

export abstract class PerfilColaboradorReader {
  abstract getPerfil(userId: number): Promise<PerfilColaborador | null>;
}

/** Contrato del colaborador (contexto Contratos). */
export interface ContratoResumen {
  id: number;
  userId: number;
  tipoContrato: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  estado: string;
}

export interface ProrrogaResumen {
  id: number;
  mesesProrroga: number;
  fechaInicioProrroga: string;
  fechaFinNueva: string;
}

export abstract class ContratoReader {
  /** Contrato activo vigente hoy (misma regla que `MiPuesto_model::get_current_contract`). */
  abstract contratoActual(userId: number): Promise<ContratoResumen | null>;
  /** Contratos con fecha fin anterior a hoy, más recientes primero. */
  abstract contratosVencidos(userId: number): Promise<ContratoResumen[]>;
  abstract contratoDeUsuario(contratoId: number, userId: number): Promise<ContratoResumen | null>;
  abstract prorrogas(contratoId: number): Promise<ProrrogaResumen[]>;
}

/** Configuración del certificado laboral y branding (tabla `app_settings`). */
export interface CertificadoConfig {
  jefeNombre: string;
  jefeCargo: string;
  /** Ruta absoluta de la firma PNG si existe en disco. */
  firmaPath: string | null;
  /** Ruta absoluta del logo si existe en disco. */
  logoPath: string | null;
  /** Sellos del membrete (Vigilado Supersubsidio, Asocajas, Fedecajas) con su ancho en puntos. */
  sellos?: Array<{ path: string; width: number }>;
}

export abstract class CertificadoConfigReader {
  abstract get(): Promise<CertificadoConfig>;
}

/** Consulta de cédulas existentes en `users` (para enriquecer la vista previa). */
export abstract class CedulasExistentesReader {
  /** Devuelve el subconjunto de `variantesNormalizadas` que ya existe en el sistema. */
  abstract existentes(variantesNormalizadas: string[]): Promise<Set<string>>;
}

/**
 * Importador de un empleado parseado: crea/actualiza sede, área, cargo,
 * usuario, salario del contrato activo y desprendible. Cada llamada a
 * `importar` debe ejecutarse en su propia transacción (atomicidad por fila).
 * La sesión conserva cachés de sede/área/cargo entre empleados de la tanda.
 */
export interface NominaImportSesion {
  importar(emp: NominaEmpleado, meta: NominaMeta, archivoPdf: string): Promise<ResultadoImportacionEmpleado>;
}

export abstract class NominaEmpleadoImporter {
  abstract iniciarSesion(): NominaImportSesion;
}
