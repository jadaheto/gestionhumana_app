import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { InvalidOperationError, NotFoundError } from '../../../../shared/domain/domain-error';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { Comunicado } from '../../domain/comunicado';
import {
  ComunicadoMedio,
  EXTENSIONES_MEDIO,
  MAX_BYTES_MEDIO,
  tipoMedioPorExtension,
} from '../../domain/comunicado-medio';
import { ComunicadoRepository } from '../../domain/comunicado.repository';
import { parsearUrlsVideo } from '../../domain/video-url';
import { toComunicadoDto, toFeedItemDto } from '../dto/comunicado.mapper';
import {
  ActualizarComunicadoInput,
  ArchivoSubido,
  ComunicadoDto,
  ComunicadoFeedItemDto,
  ComunicadoOperacionDto,
  CrearComunicadoInput,
} from '../dto/comunicados.dto';
import { PublicacionComunicadoService } from '../services/publicacion.service';

/** Carpeta de uploads (misma que el legado: `uploads/comunicados`). */
export const CARPETA_COMUNICADOS = 'comunicados';

const FEED_SIZE_DEFAULT = 9;
const FEED_SIZE_MAX = 15;

/** Guarda los archivos subidos y construye los medios (archivos + URLs de vídeo). */
async function construirMedios(
  storage: FileStorage,
  archivos: ArchivoSubido[],
  videoUrls: string | null,
): Promise<ComunicadoMedio[]> {
  const medios: ComunicadoMedio[] = [];
  for (const a of archivos) {
    const stored = await storage.save(a.buffer, {
      folder: CARPETA_COMUNICADOS,
      originalName: a.originalName,
      mimeType: a.mimeType,
      allowedExtensions: [...EXTENSIONES_MEDIO],
      maxBytes: MAX_BYTES_MEDIO,
    });
    medios.push(ComunicadoMedio.archivo(stored.relativePath, tipoMedioPorExtension(a.originalName)));
  }
  for (const url of parsearUrlsVideo(videoUrls)) medios.push(ComunicadoMedio.video(url));
  return medios;
}

async function borrarArchivos(storage: FileStorage, medios: ComunicadoMedio[]): Promise<void> {
  for (const m of medios) if (m.archivo) await storage.delete(m.archivo);
}

@Injectable()
export class ListComunicadosAdminUseCase implements UseCase<void, ComunicadoDto[]> {
  constructor(private readonly comunicados: ComunicadoRepository) {}
  async execute(): Promise<ComunicadoDto[]> {
    return (await this.comunicados.findAll()).map(({ comunicado, creadoPor }) =>
      toComunicadoDto(comunicado, creadoPor),
    );
  }
}

/** Detalle: los borradores sólo son visibles para administradores (como el legado: 404). */
@Injectable()
export class GetComunicadoUseCase implements UseCase<{ id: number; actor: Actor }, ComunicadoDto> {
  constructor(private readonly comunicados: ComunicadoRepository) {}
  async execute(input: { id: number; actor: Actor }): Promise<ComunicadoDto> {
    const c = await this.comunicados.findById(input.id);
    if (!c || (!c.estaPublicado && !isAdmin(input.actor))) throw new NotFoundError('Comunicado', input.id);
    return toComunicadoDto(c);
  }
}

/** Feed paginado de comunicados publicados (`?page=&size=`, máximo 15 por página). */
@Injectable()
export class FeedComunicadosUseCase implements UseCase<Partial<PageRequest>, Page<ComunicadoFeedItemDto>> {
  constructor(private readonly comunicados: ComunicadoRepository) {}
  async execute(input: Partial<PageRequest>): Promise<Page<ComunicadoFeedItemDto>> {
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const sizeRaw = Math.floor(input.size ?? FEED_SIZE_DEFAULT);
    const size = sizeRaw <= 0 || sizeRaw > FEED_SIZE_MAX ? FEED_SIZE_DEFAULT : sizeRaw;
    const result = await this.comunicados.findPublicados({ page, size });
    return { ...result, items: result.items.map(toFeedItemDto) };
  }
}

@Injectable()
export class CrearComunicadoUseCase implements UseCase<CrearComunicadoInput, ComunicadoOperacionDto> {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
    private readonly publicacion: PublicacionComunicadoService,
  ) {}

  async execute(input: CrearComunicadoInput): Promise<ComunicadoOperacionDto> {
    const now = this.clock.now();
    // Validar el texto antes de subir archivos para no dejar huérfanos.
    const base = Comunicado.create({
      titulo: input.titulo,
      resumen: input.resumen,
      contenido: input.contenido,
      estado: input.estado,
      createdBy: input.actor.id,
      createdAt: now,
    });
    const medios = await construirMedios(this.storage, input.archivos, input.videoUrls);
    const guardado = await this.comunicados.save(base.agregarMedios(medios, now));

    if (!guardado.estaPublicado) {
      return { comunicado: toComunicadoDto(guardado), correo: null, mensaje: 'Comunicado guardado correctamente.' };
    }
    const { comunicado, correo } = await this.publicacion.notificarYEnviar(guardado);
    return {
      comunicado: toComunicadoDto(comunicado),
      correo,
      mensaje: correo?.enviado
        ? 'Comunicado guardado, publicado y enviado por correo.'
        : `Comunicado publicado, pero no se pudo enviar el correo: ${correo?.mensaje ?? ''}`,
    };
  }
}

@Injectable()
export class ActualizarComunicadoUseCase implements UseCase<ActualizarComunicadoInput, ComunicadoDto> {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async execute(input: ActualizarComunicadoInput): Promise<ComunicadoDto> {
    const existente = await this.comunicados.findById(input.id);
    if (!existente) throw new NotFoundError('Comunicado', input.id);
    const now = this.clock.now();
    let c = existente.actualizar({ titulo: input.titulo, resumen: input.resumen, contenido: input.contenido }, now);

    const aEliminar = existente.medios.filter((m) => m.id !== null && input.eliminarMedios.includes(m.id));
    c = c.quitarMedios(input.eliminarMedios, now);
    const nuevos = await construirMedios(this.storage, input.archivos, input.videoUrls);
    c = c.agregarMedios(nuevos, now);

    const guardado = await this.comunicados.save(c);
    await borrarArchivos(this.storage, aEliminar);
    return toComunicadoDto(guardado);
  }
}

@Injectable()
export class PublicarComunicadoUseCase implements UseCase<number, ComunicadoOperacionDto> {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly clock: Clock,
    private readonly publicacion: PublicacionComunicadoService,
  ) {}

  async execute(id: number): Promise<ComunicadoOperacionDto> {
    const existente = await this.comunicados.findById(id);
    if (!existente) throw new NotFoundError('Comunicado', id);
    const publicado = await this.comunicados.save(existente.publicar(this.clock.now()));
    const { comunicado, correo } = await this.publicacion.notificarYEnviar(publicado);
    let mensaje: string;
    if (correo === null) mensaje = 'Comunicado publicado. El correo ya había sido enviado previamente.';
    else if (correo.enviado) mensaje = 'Comunicado publicado y enviado por correo.';
    else mensaje = `Comunicado publicado, pero no se pudo enviar el correo: ${correo.mensaje}`;
    return { comunicado: toComunicadoDto(comunicado), correo, mensaje };
  }
}

@Injectable()
export class ReenviarCorreoComunicadoUseCase implements UseCase<number, ComunicadoOperacionDto> {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly publicacion: PublicacionComunicadoService,
  ) {}

  async execute(id: number): Promise<ComunicadoOperacionDto> {
    const existente = await this.comunicados.findById(id);
    if (!existente) throw new NotFoundError('Comunicado', id);
    if (!existente.estaPublicado)
      throw new InvalidOperationError('Solo se puede reenviar correo de comunicados publicados.');
    const { comunicado, correo } = await this.publicacion.enviarCorreo(existente);
    return {
      comunicado: toComunicadoDto(comunicado),
      correo,
      mensaje: correo.enviado
        ? 'Correo de comunicado reenviado correctamente.'
        : `No se pudo reenviar el correo: ${correo.mensaje}`,
    };
  }
}

/** Elimina el comunicado, sus medios (cascada) y los archivos del almacenamiento. */
@Injectable()
export class EliminarComunicadoUseCase implements UseCase<number, void> {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(id: number): Promise<void> {
    const existente = await this.comunicados.findById(id);
    if (!existente) throw new NotFoundError('Comunicado', id);
    await this.comunicados.delete(id);
    await borrarArchivos(this.storage, existente.medios);
  }
}
