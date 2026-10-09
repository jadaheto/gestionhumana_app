import { Certificado, NuevoCertificado } from './certificado';
import { CuentaBancaria } from './cuenta-bancaria';
import { Desprendible } from './desprendible';
import {
  ContadoresLote,
  LotePrevioResumen,
  NominaImportError,
  NominaImportLote,
  NominaPreview,
  NuevoErrorImportacion,
  NuevoLote,
} from './nomina-import';

export abstract class CuentaBancariaRepository {
  abstract findByUser(userId: number): Promise<CuentaBancaria[]>;
  abstract findByIdAndUser(id: number, userId: number): Promise<CuentaBancaria | null>;
  abstract save(cuenta: CuentaBancaria): Promise<CuentaBancaria>;
  abstract delete(id: number): Promise<void>;
}

export abstract class DesprendibleRepository {
  /** Desprendibles del usuario ordenados por fecha fin y período descendentes. */
  abstract findByUser(userId: number): Promise<Desprendible[]>;
  abstract findByIdAndUser(id: number, userId: number): Promise<Desprendible | null>;
}

export type FiltroTipoCertificado = 'laboral' | 'ingresos_retenciones';

export abstract class CertificadoRepository {
  /** `laboral` agrupa los tipos `laboral_*` (igual que el legado con LIKE). */
  abstract findByUser(userId: number, tipo?: FiltroTipoCertificado): Promise<Certificado[]>;
  abstract save(certificado: NuevoCertificado): Promise<Certificado>;
}

export abstract class NominaImportLoteRepository {
  abstract create(lote: NuevoLote): Promise<NominaImportLote>;
  abstract findById(id: number): Promise<NominaImportLote | null>;
  /** Último lote completado/parcial del mismo período y fuente. */
  abstract findPrevioPorPeriodo(
    fechaInicio: string,
    fechaFin: string,
    fuente: string,
  ): Promise<LotePrevioResumen | null>;
  /** Incrementa los contadores de forma atómica y devuelve los valores resultantes. */
  abstract incrementarContadores(id: number, inc: Partial<ContadoresLote>): Promise<ContadoresLote>;
  abstract actualizarEstado(id: number, estado: string, detalle: string | null): Promise<void>;
  /** Marca como `error` los lotes en `procesando` anteriores a `antesDe`. Devuelve cuántos cerró. */
  abstract cerrarAtascados(antesDe: Date, detalle: string): Promise<number>;
  abstract historial(limit: number): Promise<NominaImportLote[]>;
  abstract registrarError(error: NuevoErrorImportacion): Promise<void>;
  abstract erroresDeLotes(loteIds: number[]): Promise<NominaImportError[]>;
}

/**
 * Almacén temporal de vistas previas (fase 1 → fase 2).
 * El legado usaba `uploads/nomina/preview_<token>.json`; aquí se persiste en
 * la tabla `nomina_import_previews` (ver docs/modules/nomina.md).
 */
export abstract class NominaPreviewStore {
  abstract save(preview: Omit<NominaPreview, 'token'>): Promise<NominaPreview>;
  abstract get(token: string): Promise<NominaPreview | null>;
  abstract findByLoteId(loteId: number): Promise<NominaPreview | null>;
  abstract update(token: string, cambios: Partial<Pick<NominaPreview, 'loteId' | 'procesados'>>): Promise<void>;
  abstract delete(token: string): Promise<void>;
  /** Elimina vistas previas no confirmadas anteriores a `antesDe`. */
  abstract purgar(antesDe: Date): Promise<number>;
}
