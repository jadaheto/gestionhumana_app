import { Actor } from '../../../../shared/domain/actor';
import { Page } from '../../../../shared/domain/pagination';
import { Aniversario, Cumpleanero } from '../../domain/conexiones.repository';

export interface ComunicadoMedioDto {
  id: number;
  tipo: 'imagen' | 'video' | 'pdf';
  /** Ruta relativa a `/uploads/` (null para vídeos por URL). */
  archivo: string | null;
  url: string | null;
  orden: number;
}

export interface ComunicadoDto {
  id: number;
  titulo: string;
  resumen: string | null;
  contenido: string;
  estado: 'borrador' | 'publicado';
  publicadoAt: string | null;
  emailEnviadoAt: string | null;
  createdBy: number | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  medios: ComunicadoMedioDto[];
}

export type TipoVistaPrevia = 'imagen' | 'video_archivo' | 'video_url' | 'pdf';

/** Elemento del feed público (equivale a `Comunicados::feed_json`). */
export interface ComunicadoFeedItemDto {
  id: number;
  titulo: string;
  resumen: string | null;
  contenido: string;
  publicadoAt: string | null;
  previewType: TipoVistaPrevia | null;
  previewSrc: string | null;
}

export type ComunicadosFeedPage = Page<ComunicadoFeedItemDto>;

/** Archivo recibido por HTTP (multer en memoria). */
export interface ArchivoSubido {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface CrearComunicadoInput {
  actor: Actor;
  titulo: string;
  resumen: string | null;
  contenido: string;
  estado: 'borrador' | 'publicado';
  archivos: ArchivoSubido[];
  /** Texto con una URL de vídeo por línea. */
  videoUrls: string | null;
}

export interface ActualizarComunicadoInput {
  id: number;
  titulo: string;
  resumen: string | null;
  contenido: string;
  archivos: ArchivoSubido[];
  videoUrls: string | null;
  /** Ids de medios existentes a eliminar. */
  eliminarMedios: number[];
}

export interface ResultadoCorreo {
  enviado: boolean;
  mensaje: string;
}

/** Resultado de crear/publicar/reenviar: el comunicado y qué pasó con el correo. */
export interface ComunicadoOperacionDto {
  comunicado: ComunicadoDto;
  correo: ResultadoCorreo | null;
  mensaje: string;
}

export interface ConexionesFeedDto {
  fecha: string;
  cumpleaneros: Cumpleanero[];
  aniversarios: Aniversario[];
}
