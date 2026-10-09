import { Comunicado } from '../../domain/comunicado';
import { ComunicadoDto, ComunicadoFeedItemDto, ComunicadoMedioDto } from './comunicados.dto';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toComunicadoDto(c: Comunicado, creadoPor: string | null = null): ComunicadoDto {
  const p = c.props;
  return {
    id: p.id ?? 0,
    titulo: p.titulo,
    resumen: p.resumen,
    contenido: p.contenido,
    estado: p.estado,
    publicadoAt: iso(p.publicadoAt),
    emailEnviadoAt: iso(p.emailEnviadoAt),
    createdBy: p.createdBy,
    creadoPor,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    medios: p.medios.map((m): ComunicadoMedioDto => ({
      id: m.props.id ?? 0,
      tipo: m.props.tipo,
      archivo: m.props.archivo,
      url: m.props.url,
      orden: m.props.orden,
    })),
  };
}

/** Vista previa del feed: el primer medio decide el tipo (regla del legado). */
export function toFeedItemDto(c: Comunicado): ComunicadoFeedItemDto {
  const p = c.props;
  const m = p.medios[0];
  let previewType: ComunicadoFeedItemDto['previewType'] = null;
  let previewSrc: string | null = null;
  if (m) {
    if (m.tipo === 'imagen' && m.archivo) {
      previewType = 'imagen';
      previewSrc = m.archivo;
    } else if (m.tipo === 'video' && m.archivo) {
      previewType = 'video_archivo';
      previewSrc = m.archivo;
    } else if (m.tipo === 'pdf' && m.archivo) {
      previewType = 'pdf';
      previewSrc = m.archivo;
    } else if (m.tipo === 'video' && m.url) {
      previewType = 'video_url';
      previewSrc = m.url;
    }
  }
  return {
    id: p.id ?? 0,
    titulo: p.titulo,
    resumen: p.resumen,
    contenido: p.contenido,
    publicadoAt: iso(p.publicadoAt),
    previewType,
    previewSrc,
  };
}
