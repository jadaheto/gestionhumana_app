import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { InvalidOperationError, NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import {
  contadoresVacios,
  ContadoresLote,
  estadoFinalLote,
  HORAS_VIDA_PREVIEW,
  MINUTOS_LOTE_ATASCADO,
  NominaEmpleadoPreview,
  NominaImportError,
  NominaImportLote,
  NominaPreview,
  PreviewExpiradaError,
  referenciaEmpleado,
  TAMANO_TANDA_DEFECTO,
  TAMANO_TANDA_MAXIMO,
  variantesCedula,
} from '../../domain/nomina-import';
import { NominaParser } from '../../domain/nomina-parser';
import { CedulasExistentesReader, NominaEmpleadoImporter } from '../../domain/ports';
import { NominaImportLoteRepository, NominaPreviewStore } from '../../domain/repositories';
import { ConfirmarImportacionDto, LoteDto, NominaPreviewDto, ProgresoLoteDto } from '../dto/nomina.dto';
import { PdfTextExtractor } from '../ports/pdf-text-extractor.port';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const DETALLE_LOTE_ATASCADO = 'Importación interrumpida (marcada automáticamente).';

export function toPreviewDto(p: NominaPreview): NominaPreviewDto {
  return {
    token: p.token,
    archivoOriginal: p.archivoOriginal,
    parsed: p.parsed,
    nuevos: p.nuevos,
    existentes: p.existentes,
    lotePrevio: p.lotePrevio,
    loteId: p.loteId,
    procesados: p.procesados,
  };
}

export function toLoteDto(l: NominaImportLote, errores: NominaImportError[] = []): LoteDto {
  return {
    id: l.id,
    archivo: l.archivo,
    archivoOriginal: l.archivoOriginal,
    fuente: l.fuente,
    tipoNomina: l.tipoNomina,
    fechaLiquidacion: l.fechaLiquidacion,
    fechaInicio: l.fechaInicio,
    fechaFin: l.fechaFin,
    totalEmpleadosPdf: l.totalEmpleadosPdf,
    empleadosCreados: l.empleadosCreados,
    empleadosActualizados: l.empleadosActualizados,
    desprendiblesCreados: l.desprendiblesCreados,
    desprendiblesActualizados: l.desprendiblesActualizados,
    contratosActualizados: l.contratosActualizados,
    errores: l.errores,
    estado: l.estado,
    detalle: l.detalle,
    createdByNombre: l.createdByNombre ?? null,
    createdAt: l.createdAt,
    erroresDetalle: errores
      .filter((e) => e.loteId === l.id)
      .map((e) => ({ id: e.id, empleadoRef: e.empleadoRef, mensaje: e.mensaje })),
  };
}

/** Marca como `error` los lotes que llevan más de 30 minutos en `procesando`. */
@Injectable()
export class CerrarLotesAtascadosUseCase implements UseCase<void, { cerrados: number }> {
  constructor(
    private readonly lotes: NominaImportLoteRepository,
    private readonly clock: Clock,
  ) {}
  async execute(): Promise<{ cerrados: number }> {
    const limite = new Date(this.clock.now().getTime() - MINUTOS_LOTE_ATASCADO * 60_000);
    return { cerrados: await this.lotes.cerrarAtascados(limite, DETALLE_LOTE_ATASCADO) };
  }
}

export interface PrevisualizarImportacionInput {
  actor: Actor;
  archivo: Buffer;
  nombreOriginal: string;
  mimeType: string;
  /** `auto`/vacío = detectar desde el PDF. */
  fuente?: string | null;
}

/**
 * Fase 1 (port de `AdminUsuarios::procesar_importar_nomina_pdf`): guarda el
 * PDF, extrae el texto, lo parsea, marca qué cédulas ya existen, detecta un
 * lote previo del mismo período y persiste la vista previa con un token.
 * No escribe nada en usuarios ni desprendibles.
 */
@Injectable()
export class PrevisualizarImportacionUseCase implements UseCase<PrevisualizarImportacionInput, NominaPreviewDto> {
  constructor(
    private readonly storage: FileStorage,
    private readonly extractor: PdfTextExtractor,
    private readonly cedulas: CedulasExistentesReader,
    private readonly lotes: NominaImportLoteRepository,
    private readonly previews: NominaPreviewStore,
    private readonly clock: Clock,
    private readonly parser: NominaParser = new NominaParser(),
  ) {}

  async execute(input: PrevisualizarImportacionInput): Promise<NominaPreviewDto> {
    if (!input.archivo || input.archivo.length === 0)
      throw new ValidationError('Debes seleccionar el archivo PDF de nómina.');
    const stored = await this.storage.save(input.archivo, {
      folder: 'nomina',
      originalName: input.nombreOriginal || 'nomina.pdf',
      mimeType: input.mimeType || 'application/pdf',
      allowedExtensions: ['pdf'],
      maxBytes: MAX_PDF_BYTES,
    });

    const texto = await this.extractor.extract(input.archivo);
    if (texto.trim() === '') {
      await this.storage.delete(stored.relativePath);
      throw new ValidationError(
        'No se pudo leer texto del PDF. Verifica que el servidor tenga pdftotext instalado o que el PDF no sea solo imagen.',
      );
    }

    const parsed = this.parser.parse(texto);
    const forzada = (input.fuente ?? '').trim();
    if (forzada !== '' && forzada.toLowerCase() !== 'auto') parsed.meta.fuente = forzada.toUpperCase();
    if (parsed.meta.fuente === '') parsed.meta.fuente = 'COLEGIO';

    if (parsed.empleados.length === 0) {
      await this.storage.delete(stored.relativePath);
      throw new ValidationError(
        'No se detectaron bloques de empleados en el PDF. Revisa que sea el reporte de liquidación de nómina.',
      );
    }

    // Enriquecer: ¿cada empleado ya existe? Una sola consulta para todo el lote.
    const variantes = Array.from(new Set(parsed.empleados.flatMap((e) => variantesCedula(e))));
    const existentes = variantes.length > 0 ? await this.cedulas.existentes(variantes) : new Set<string>();
    let nuevos = 0;
    const empleados: NominaEmpleadoPreview[] = parsed.empleados.map((e) => {
      const existe = variantesCedula(e).some((v) => existentes.has(v));
      if (!existe) nuevos++;
      return { ...e, existe };
    });

    // ¿El período ya fue importado antes?
    const lotePrevio =
      parsed.meta.fechaInicio && parsed.meta.fechaFin
        ? await this.lotes.findPrevioPorPeriodo(parsed.meta.fechaInicio, parsed.meta.fechaFin, parsed.meta.fuente)
        : null;

    // Limpia vistas previas anteriores no confirmadas (más de 24 h).
    await this.previews.purgar(new Date(this.clock.now().getTime() - HORAS_VIDA_PREVIEW * 3_600_000));

    const preview = await this.previews.save({
      parsed: { ...parsed, empleados },
      archivo: stored.relativePath,
      archivoOriginal: input.nombreOriginal || stored.filename,
      nuevos,
      existentes: empleados.length - nuevos,
      lotePrevio,
      loteId: null,
      procesados: 0,
      createdBy: input.actor.id,
      createdAt: this.clock.now(),
    });
    return toPreviewDto(preview);
  }
}

@Injectable()
export class ObtenerPreviewUseCase implements UseCase<string, NominaPreviewDto> {
  constructor(private readonly previews: NominaPreviewStore) {}
  async execute(token: string): Promise<NominaPreviewDto> {
    const p = await this.previews.get(token);
    if (!p) throw new PreviewExpiradaError();
    return toPreviewDto(p);
  }
}

/**
 * Fase 2a (port de `iniciar_importar_nomina`): crea el lote en estado
 * `procesando` y devuelve el total a procesar. Si ya se había iniciado
 * (doble clic), reanuda el mismo lote.
 */
@Injectable()
export class ConfirmarImportacionUseCase implements UseCase<{ actor: Actor; token: string }, ConfirmarImportacionDto> {
  constructor(
    private readonly previews: NominaPreviewStore,
    private readonly lotes: NominaImportLoteRepository,
  ) {}

  async execute({ actor, token }: { actor: Actor; token: string }): Promise<ConfirmarImportacionDto> {
    const preview = await this.previews.get(token);
    if (!preview) throw new PreviewExpiradaError();
    const total = preview.parsed.empleados.length;
    if (total === 0) {
      await this.previews.delete(token);
      throw new ValidationError('La vista previa no contiene empleados.');
    }
    if (preview.loteId) return { loteId: preview.loteId, total };

    const meta = preview.parsed.meta;
    const lote = await this.lotes.create({
      archivo: preview.archivo,
      archivoOriginal: preview.archivoOriginal,
      fuente: meta.fuente || 'SIN_FUENTE',
      tipoNomina: meta.tipoNomina || '',
      fechaLiquidacion: meta.fechaLiquidacion,
      fechaInicio: meta.fechaInicio,
      fechaFin: meta.fechaFin,
      totalEmpleadosPdf: total,
      estado: 'procesando',
      detalle: null,
      createdBy: actor.id,
    });
    await this.previews.update(token, { loteId: lote.id });
    return { loteId: lote.id, total };
  }
}

/** Cancela una vista previa no confirmada y limpia el PDF temporal. */
@Injectable()
export class CancelarImportacionUseCase implements UseCase<string, void> {
  constructor(
    private readonly previews: NominaPreviewStore,
    private readonly storage: FileStorage,
  ) {}
  async execute(token: string): Promise<void> {
    const preview = await this.previews.get(token);
    if (!preview) throw new PreviewExpiradaError();
    if (preview.loteId)
      throw new InvalidOperationError('La importación ya fue iniciada; no se puede cancelar la vista previa.');
    await this.previews.delete(token);
    await this.storage.delete(preview.archivo);
  }
}

export interface ProcesarLoteInput {
  loteId: number;
  /** Si se omite, continúa desde el último empleado procesado. */
  offset?: number | null;
  size?: number | null;
}

/**
 * Fase 2b (port de `procesar_lote_nomina`): procesa una tanda de empleados
 * (cada uno en su propia transacción, vía `NominaEmpleadoImporter`), acumula
 * errores en `nomina_import_errores`, incrementa los contadores del lote y,
 * al terminar, cierra el lote como `completado` o `parcial`.
 */
@Injectable()
export class ProcesarLoteUseCase implements UseCase<ProcesarLoteInput, ProgresoLoteDto> {
  constructor(
    private readonly lotes: NominaImportLoteRepository,
    private readonly previews: NominaPreviewStore,
    private readonly importer: NominaEmpleadoImporter,
  ) {}

  async execute(input: ProcesarLoteInput): Promise<ProgresoLoteDto> {
    const lote = await this.lotes.findById(input.loteId);
    if (!lote) throw new NotFoundError('Lote de importación', input.loteId);
    if (lote.estado !== 'procesando') {
      throw new InvalidOperationError(`El lote #${lote.id} ya fue finalizado (estado: ${lote.estado}).`);
    }
    const preview = await this.previews.findByLoteId(lote.id);
    if (!preview) throw new InvalidOperationError('La sesión de importación expiró. Vuelve a subir el PDF.');

    const empleados = preview.parsed.empleados;
    const total = empleados.length;
    const offset = Math.max(0, input.offset ?? preview.procesados ?? 0);
    const size = Math.min(TAMANO_TANDA_MAXIMO, Math.max(1, input.size ?? TAMANO_TANDA_DEFECTO));
    const tanda = empleados.slice(offset, offset + size);

    const inc: ContadoresLote = contadoresVacios();
    const sesion = this.importer.iniciarSesion();
    for (const emp of tanda) {
      try {
        const r = await sesion.importar(emp, preview.parsed.meta, preview.archivo);
        if (r.empleadoCreado) inc.empleadosCreados++;
        else inc.empleadosActualizados++;
        if (r.desprendibleCreado) inc.desprendiblesCreados++;
        else inc.desprendiblesActualizados++;
        if (r.contratoActualizado) inc.contratosActualizados++;
      } catch (e) {
        inc.errores++;
        await this.lotes.registrarError({
          loteId: lote.id,
          empleadoRef: referenciaEmpleado(emp),
          mensaje: e instanceof Error ? e.message : String(e),
          rawBlock: (emp.rawBlock ?? '').slice(0, 3000),
        });
      }
    }

    const counts = await this.lotes.incrementarContadores(lote.id, inc);
    const processed = Math.min(offset + tanda.length, total);
    const done = processed >= total || tanda.length === 0;
    let estado: string = lote.estado;

    if (done) {
      estado = estadoFinalLote(counts.errores);
      await this.lotes.actualizarEstado(lote.id, estado, `Importación desde PDF ${preview.archivoOriginal}`);
      await this.previews.delete(preview.token);
    } else {
      await this.previews.update(preview.token, { procesados: processed });
    }

    return { loteId: lote.id, processed, total, done, estado, counts };
  }
}

@Injectable()
export class GetLoteUseCase implements UseCase<number, LoteDto> {
  constructor(private readonly lotes: NominaImportLoteRepository) {}
  async execute(id: number): Promise<LoteDto> {
    const lote = await this.lotes.findById(id);
    if (!lote) throw new NotFoundError('Lote de importación', id);
    return toLoteDto(lote, await this.lotes.erroresDeLotes([id]));
  }
}

/** Historial de lotes (máx. 100) con sus errores; antes cierra los lotes atascados. */
@Injectable()
export class HistorialImportacionesUseCase implements UseCase<void, LoteDto[]> {
  constructor(
    private readonly lotes: NominaImportLoteRepository,
    private readonly cerrar: CerrarLotesAtascadosUseCase,
  ) {}
  async execute(): Promise<LoteDto[]> {
    await this.cerrar.execute();
    const lista = await this.lotes.historial(100);
    const errores = lista.length > 0 ? await this.lotes.erroresDeLotes(lista.map((l) => l.id)) : [];
    return lista.map((l) => toLoteDto(l, errores));
  }
}
