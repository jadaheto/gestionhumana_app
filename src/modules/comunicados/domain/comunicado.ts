import { ValidationError } from '../../../shared/domain/domain-error';
import { ComunicadoMedio } from './comunicado-medio';

export type EstadoComunicado = 'borrador' | 'publicado';

export interface ComunicadoProps {
  id: number | null;
  titulo: string;
  resumen: string | null;
  contenido: string;
  estado: EstadoComunicado;
  publicadoAt: Date | null;
  emailEnviadoAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  medios: ComunicadoMedio[];
}

/** Agregado Comunicado interno con sus medios (imagen/video/pdf/URL de vídeo). */
export class Comunicado {
  private constructor(readonly props: ComunicadoProps) {}

  static create(props: Partial<ComunicadoProps> & { titulo: string; contenido: string; createdAt: Date }): Comunicado {
    const titulo = (props.titulo ?? '').trim();
    const contenido = (props.contenido ?? '').trim();
    if (titulo === '' || contenido === '') throw new ValidationError('Título y contenido son obligatorios.');
    if (titulo.length > 200) throw new ValidationError('El título no puede superar 200 caracteres.');
    const estado: EstadoComunicado = props.estado === 'publicado' ? 'publicado' : 'borrador';
    return new Comunicado({
      id: props.id ?? null,
      titulo,
      resumen: props.resumen?.trim() || null,
      contenido,
      estado,
      publicadoAt: props.publicadoAt ?? (estado === 'publicado' ? props.createdAt : null),
      emailEnviadoAt: props.emailEnviadoAt ?? null,
      createdBy: props.createdBy ?? null,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt ?? props.createdAt,
      medios: Comunicado.ordenar(props.medios ?? []),
    });
  }

  private static ordenar(medios: ComunicadoMedio[]): ComunicadoMedio[] {
    return medios.map((m, i) => m.withOrden(i + 1));
  }

  get id() {
    return this.props.id;
  }
  get titulo() {
    return this.props.titulo;
  }
  get estado() {
    return this.props.estado;
  }
  get medios() {
    return this.props.medios;
  }
  get estaPublicado(): boolean {
    return this.props.estado === 'publicado';
  }
  get correoEnviado(): boolean {
    return this.props.emailEnviadoAt !== null;
  }

  withId(id: number): Comunicado {
    return new Comunicado({ ...this.props, id });
  }

  /** Edita título, resumen y contenido (sólo campos de texto). */
  actualizar(datos: { titulo: string; resumen: string | null; contenido: string }, now: Date): Comunicado {
    return Comunicado.create({ ...this.props, ...datos, updatedAt: now });
  }

  /** Publica el comunicado (idempotente: siempre fija `publicado_at` como el legado). */
  publicar(now: Date): Comunicado {
    return new Comunicado({ ...this.props, estado: 'publicado', publicadoAt: now, updatedAt: now });
  }

  marcarCorreoEnviado(now: Date): Comunicado {
    return new Comunicado({ ...this.props, emailEnviadoAt: now, updatedAt: now });
  }

  agregarMedios(nuevos: ComunicadoMedio[], now: Date): Comunicado {
    return new Comunicado({
      ...this.props,
      medios: Comunicado.ordenar([...this.props.medios, ...nuevos]),
      updatedAt: now,
    });
  }

  quitarMedios(ids: number[], now: Date): Comunicado {
    if (ids.length === 0) return this;
    return new Comunicado({
      ...this.props,
      medios: Comunicado.ordenar(this.props.medios.filter((m) => !m.id || !ids.includes(m.id))),
      updatedAt: now,
    });
  }
}
