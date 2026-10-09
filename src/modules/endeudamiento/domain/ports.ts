import { ConceptoCalculado } from './endeudamiento-calculator';
import { SolicitudEndeudamiento } from './solicitud-endeudamiento';

/** Datos del colaborador necesarios en listados y detalle. */
export interface ColaboradorBasico {
  id: number;
  firstName: string | null;
  lastName: string | null;
  cedula: string | null;
  codigoEmpresa: string | null;
}

/** Fila persistida (cabecera) tal como la devuelven los listados. */
export interface SolicitudPersistida {
  id: number;
  userId: number;
  solicitudNo: string;
  fecha: string;
  anio: number | null;
  libranza: string | null;
  salarioMensual: number;
  otrosDevengados: number;
  totalDevengado: number;
  totalDeducido: number;
  netoActual: number;
  deduccionesLey: number;
  deduccionesEndeudamiento: number;
  porcentajeActual: number;
  valorSolicitado: number;
  plazoMeses: number;
  cuotaMensual: number;
  valorQuincenal: number;
  porcentajeNuevoCredito: number;
  netoRecibir: number;
  umbralAprobacion: number;
  opcionCredito: string | null;
  conclusion: string | null;
  estado: string;
  createdBy: number | null;
  createdAt: Date | null;
  colaborador: ColaboradorBasico | null;
}

export interface SolicitudPersistidaConConceptos extends SolicitudPersistida {
  conceptos: Array<ConceptoCalculado & { id: number; orden: number }>;
}

export abstract class EndeudamientoRepository {
  abstract findAll(): Promise<SolicitudPersistida[]>;
  abstract findById(id: number): Promise<SolicitudPersistidaConConceptos | null>;
  /** Inserta cabecera y conceptos en una transacción; devuelve el id. */
  abstract save(solicitud: SolicitudEndeudamiento, createdBy: number, createdAt: Date): Promise<number>;
  abstract countByAnio(anio: number): Promise<number>;
}

/** Puerto hacia el contexto de colaboradores (`users`). */
export abstract class ColaboradorFinder {
  /** Busca por nombre, apellido, cédula o código (no administradores), máximo 20. */
  abstract search(q: string): Promise<ColaboradorBasico[]>;
  abstract findById(id: number): Promise<ColaboradorBasico | null>;
}

/**
 * Salario de referencia del colaborador: salario base del contrato activo más
 * reciente o, en su defecto, `cargo_salarios.salario_2024 + aumento_2025`.
 */
export abstract class SalarioReferenciaReader {
  abstract salarioReferencia(userId: number): Promise<number>;
}
