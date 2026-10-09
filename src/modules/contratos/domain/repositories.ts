import { Contrato } from './contrato';
import { ContratoAlerta, ContratoProrroga } from './contrato-prorroga';

/** Datos del colaborador que acompañan al contrato en listados y documentos. */
export interface DatosColaborador {
  firstName: string | null;
  lastName: string | null;
  cedula: string | null;
  codigoEmpresa: string | null;
  areaNombre: string | null;
  cargoNombre: string | null;
}

export interface ContratoConColaborador {
  contrato: Contrato;
  colaborador: DatosColaborador;
}

export abstract class ContratoRepository {
  /** Todos los contratos con datos del colaborador, ordenados por fecha inicio DESC (`get_all`). */
  abstract findAll(): Promise<ContratoConColaborador[]>;
  /** Contratos de un usuario, ordenados por fecha inicio DESC (`get_by_user`). */
  abstract findByUser(userId: number): Promise<ContratoConColaborador[]>;
  abstract findById(id: number): Promise<Contrato | null>;
  /** Contrato con usuario, área y cargo (`get_with_user`). */
  abstract findByIdConColaborador(id: number): Promise<ContratoConColaborador | null>;
  abstract save(contrato: Contrato): Promise<Contrato>;
  abstract delete(id: number): Promise<void>;
  /** Marca como finalizados los activos con `fecha_fin < hoy`. Devuelve cuántos cambió. */
  abstract finalizarVencidos(hoy: string): Promise<number>;
  /** Activos con fecha fin entre hoy y hoy + `dias` (`get_por_vencer`). */
  abstract findPorVencer(hoy: string, dias: number): Promise<ContratoConColaborador[]>;
}

export abstract class ContratoProrrogaRepository {
  /** Inserta la prórroga y actualiza el contrato en una misma transacción. */
  abstract registrar(prorroga: ContratoProrroga, contratoActualizado: Contrato): Promise<ContratoProrroga>;
  abstract findByContrato(contratoId: number): Promise<ContratoProrroga[]>;
}

export abstract class ContratoAlertaRepository {
  abstract exists(alerta: ContratoAlerta): Promise<boolean>;
  /** Inserta la alerta; si ya existe (índice único) no falla. */
  abstract save(alerta: ContratoAlerta): Promise<void>;
}
