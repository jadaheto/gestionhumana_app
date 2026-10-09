import { ValidationError } from '../../../shared/domain/domain-error';

/** Tipos de medio admitidos en un comunicado (columna `comunicado_medios.tipo`). */
export type TipoMedio = 'imagen' | 'video' | 'pdf';

/** Extensiones admitidas para los archivos de un comunicado (mismas que el legado). */
export const EXTENSIONES_MEDIO = ['gif', 'jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'ogg', 'pdf'] as const;
/** Tamaño máximo por archivo: 50 MB (el legado configuraba `max_size = 51200` KB). */
export const MAX_BYTES_MEDIO = 51200 * 1024;

const EXT_VIDEO = ['mp4', 'webm', 'ogg'];

/** Deduce el tipo de medio a partir de la extensión del archivo (regla del legado). */
export function tipoMedioPorExtension(nombreArchivo: string): TipoMedio {
  const ext = (nombreArchivo.split('.').pop() ?? '').toLowerCase();
  if (EXT_VIDEO.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'imagen';
}

/**
 * Normaliza la ruta de un archivo almacenado. El legado guardaba
 * `uploads/comunicados/x.png`; el nuevo almacenamiento guarda rutas relativas
 * al directorio de uploads (`comunicados/x.png`). Ambas se sirven en `/uploads/...`.
 */
export function normalizarRutaArchivo(archivo: string | null | undefined): string | null {
  const limpio = (archivo ?? '').trim().replace(/^\/+/, '');
  if (limpio === '') return null;
  return limpio.startsWith('uploads/') ? limpio.slice('uploads/'.length) : limpio;
}

export interface ComunicadoMedioProps {
  id: number | null;
  comunicadoId: number | null;
  tipo: TipoMedio;
  /** Ruta relativa al directorio de uploads (p. ej. `comunicados/abc.png`). */
  archivo: string | null;
  /** URL externa (vídeos de YouTube, Vimeo, etc.). */
  url: string | null;
  orden: number;
}

export class ComunicadoMedio {
  private constructor(readonly props: ComunicadoMedioProps) {}

  static create(props: Partial<ComunicadoMedioProps> & { tipo: TipoMedio }): ComunicadoMedio {
    const archivo = normalizarRutaArchivo(props.archivo);
    const url = props.url?.trim() || null;
    if (!archivo && !url) throw new ValidationError('Un medio debe tener un archivo o una URL.');
    if (!['imagen', 'video', 'pdf'].includes(props.tipo)) throw new ValidationError('Tipo de medio inválido.');
    return new ComunicadoMedio({
      id: props.id ?? null,
      comunicadoId: props.comunicadoId ?? null,
      tipo: props.tipo,
      archivo,
      url,
      orden: props.orden ?? 0,
    });
  }

  static archivo(archivo: string, tipo: TipoMedio, orden = 0): ComunicadoMedio {
    return ComunicadoMedio.create({ tipo, archivo, url: null, orden });
  }

  static video(url: string, orden = 0): ComunicadoMedio {
    return ComunicadoMedio.create({ tipo: 'video', archivo: null, url, orden });
  }

  get id() {
    return this.props.id;
  }
  get tipo() {
    return this.props.tipo;
  }
  get archivo() {
    return this.props.archivo;
  }
  get url() {
    return this.props.url;
  }

  withIds(id: number, comunicadoId: number): ComunicadoMedio {
    return new ComunicadoMedio({ ...this.props, id, comunicadoId });
  }
  withOrden(orden: number): ComunicadoMedio {
    return new ComunicadoMedio({ ...this.props, orden });
  }
}
