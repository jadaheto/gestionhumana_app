import { Page, PageRequest } from '../../../shared/domain/pagination';
import { Comunicado } from './comunicado';

/** Comunicado junto al nombre de quien lo creó (listado de administración). */
export interface ComunicadoConAutor {
  comunicado: Comunicado;
  creadoPor: string | null;
}

export abstract class ComunicadoRepository {
  /** Todos los comunicados (borradores y publicados) ordenados por creación desc. */
  abstract findAll(): Promise<ComunicadoConAutor[]>;
  abstract findById(id: number): Promise<Comunicado | null>;
  /** Publicados ordenados por `publicado_at` desc, `id` desc. */
  abstract findPublicados(page: PageRequest): Promise<Page<Comunicado>>;
  /** Inserta o actualiza el comunicado y sincroniza sus medios. */
  abstract save(comunicado: Comunicado): Promise<Comunicado>;
  abstract delete(id: number): Promise<void>;
}
