import { InvalidOperationError, ValidationError } from '../../../shared/domain/domain-error';
import { parseIsoDate } from './dias-habiles.calculator';

/** Tipos de solicitud permitidos (mismos valores que el legado). */
export const TIPOS_PERMISO = [
  'personal',
  'medico',
  'calamidad',
  'diligencia',
  'estudio',
  'otro',
  'vacaciones',
  'incapacidad',
] as const;
export type TipoPermiso = (typeof TIPOS_PERMISO)[number];

export const ESTADOS_PERMISO = ['pendiente', 'aprobado', 'rechazado'] as const;
export type EstadoPermiso = (typeof ESTADOS_PERMISO)[number];

/**
 * Visto bueno del jefe inmediato (primer paso de la aprobación):
 * `no_aplica` = el colaborador no tiene jefe en el organigrama y la solicitud pasa directo a Gestión Humana.
 */
export const ESTADOS_JEFE = ['no_aplica', 'pendiente', 'aprobado', 'rechazado'] as const;
export type EstadoJefe = (typeof ESTADOS_JEFE)[number];

/** Paso en el que está la solicitud: espera al jefe, espera a Gestión Humana o ya se resolvió. */
export type EtapaPermiso = 'jefe' | 'gestion_humana' | 'finalizada';

export function isTipoPermiso(value: unknown): value is TipoPermiso {
  return typeof value === 'string' && (TIPOS_PERMISO as readonly string[]).includes(value);
}

export interface PermisoProps {
  id: number | null;
  userId: number;
  tipoPermiso: TipoPermiso;
  /** `YYYY-MM-DD` */
  fechaSolicitud: string | null;
  /** `YYYY-MM-DD HH:mm:ss` (la tabla usa TIMESTAMP) */
  fechaInicio: string;
  fechaFin: string;
  horas: number | null;
  justificacion: string;
  /** Ruta relativa del archivo en `uploads/` (p. ej. `soportes/abc.pdf`). */
  archivoSoporte: string | null;
  estado: EstadoPermiso;
  aprobadoPor: number | null;
  observacionRespuesta: string | null;
  /** Jefe inmediato que debe dar el visto bueno (null = sin jefe en el organigrama). */
  jefeId: number | null;
  jefeEstado: EstadoJefe;
  jefeObservacion: string | null;
  /** `YYYY-MM-DD HH:mm:ss` en que el jefe respondió. */
  jefeFecha: string | null;
  /** Quién registró la respuesta del jefe: el propio jefe o un administrador en su nombre. */
  jefeResueltoPor: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type NuevoPermisoProps = Pick<PermisoProps, 'userId' | 'justificacion'> & {
  tipoPermiso: string;
  fechaInicio: string;
  fechaFin: string;
  horas?: number | null;
  archivoSoporte?: string | null;
  fechaSolicitud?: string | null;
  /** Jefe inmediato según el organigrama (null = pasa directo a Gestión Humana). */
  jefeId?: number | null;
};

/**
 * Solicitud de permiso / vacaciones / incapacidad (tabla `permisos`).
 * Reglas migradas de `Solicitudes::guardar`, `aprobar` y `rechazar`.
 */
export class Permiso {
  private constructor(readonly props: PermisoProps) {}

  /** Crea una solicitud nueva en estado `pendiente` validando las reglas del legado. */
  static create(props: NuevoPermisoProps): Permiso {
    if (!isTipoPermiso(props.tipoPermiso)) {
      throw new ValidationError('Tipo de solicitud inválido.');
    }
    const inicio = normalizarFechaHora(props.fechaInicio);
    const fin = normalizarFechaHora(props.fechaFin);
    if (inicio === null || fin === null || fin < inicio) {
      throw new ValidationError('Las fechas de la solicitud no son válidas.');
    }
    const justificacion = (props.justificacion ?? '').trim();
    if (justificacion === '') {
      throw new ValidationError('La justificación es obligatoria.');
    }
    const archivo = props.archivoSoporte?.trim() || null;
    if (props.tipoPermiso === 'incapacidad' && !archivo) {
      throw new ValidationError('Para incapacidad debes adjuntar archivo soporte.');
    }
    const sinHoras = props.tipoPermiso === 'vacaciones' || props.tipoPermiso === 'incapacidad';
    let horas: number | null = null;
    if (!sinHoras && props.horas !== null && props.horas !== undefined) {
      if (!Number.isFinite(props.horas) || props.horas < 0) {
        throw new ValidationError('Las horas deben ser un número mayor o igual a 0.');
      }
      horas = props.horas;
    }
    return new Permiso({
      id: null,
      userId: props.userId,
      tipoPermiso: props.tipoPermiso,
      fechaSolicitud: props.fechaSolicitud ?? null,
      fechaInicio: inicio,
      fechaFin: fin,
      horas,
      justificacion,
      archivoSoporte: archivo,
      estado: 'pendiente',
      aprobadoPor: null,
      observacionRespuesta: null,
      jefeId: props.jefeId ?? null,
      jefeEstado: props.jefeId ? 'pendiente' : 'no_aplica',
      jefeObservacion: null,
      jefeFecha: null,
      jefeResueltoPor: null,
      createdAt: null,
      updatedAt: null,
    });
  }

  /** Reconstituye desde persistencia sin volver a validar. */
  static rehydrate(props: PermisoProps): Permiso {
    return new Permiso(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get userId(): number {
    return this.props.userId;
  }
  get estado(): EstadoPermiso {
    return this.props.estado;
  }
  get tipoPermiso(): TipoPermiso {
    return this.props.tipoPermiso;
  }
  get esVacaciones(): boolean {
    return this.props.tipoPermiso === 'vacaciones';
  }
  get estaPendiente(): boolean {
    return this.props.estado === 'pendiente';
  }
  /** Sigue pendiente y aún no tiene el visto bueno del jefe inmediato. */
  get esperaJefe(): boolean {
    return this.estaPendiente && this.props.jefeEstado === 'pendiente';
  }
  get etapa(): EtapaPermiso {
    if (!this.estaPendiente) return 'finalizada';
    return this.esperaJefe ? 'jefe' : 'gestion_humana';
  }
  /** Parte de fecha (`YYYY-MM-DD`) de la fecha de inicio. */
  get fechaInicioDia(): string {
    return this.props.fechaInicio.slice(0, 10);
  }
  get fechaFinDia(): string {
    return this.props.fechaFin.slice(0, 10);
  }

  withId(id: number): Permiso {
    return new Permiso({ ...this.props, id });
  }

  /** Visto bueno del jefe inmediato: la solicitud sigue pendiente, ahora a cargo de Gestión Humana. */
  aprobarComoJefe(observacion: string | null, ahora: string): Permiso {
    return this.registrarVistoBueno(this.props.jefeId, observacion, ahora);
  }

  /**
   * Visto bueno que un administrador registra en nombre del jefe inmediato (p. ej. si está ausente).
   * Exige dejar el motivo; después sigue faltando la aprobación de Gestión Humana.
   */
  aprobarEnNombreDelJefe(adminId: number, motivo: string | null, ahora: string): Permiso {
    if (!motivo?.trim()) {
      throw new ValidationError('Indica el motivo por el que apruebas en nombre del jefe inmediato.');
    }
    return this.registrarVistoBueno(adminId, motivo, ahora);
  }

  private registrarVistoBueno(resueltoPor: number | null, observacion: string | null, ahora: string): Permiso {
    this.exigirTurnoDelJefe();
    return new Permiso({
      ...this.props,
      jefeEstado: 'aprobado',
      jefeObservacion: observacion?.trim() || null,
      jefeFecha: ahora,
      jefeResueltoPor: resueltoPor,
      updatedAt: ahora,
    });
  }

  /** El visto bueno del jefe lo registró un administrador en su nombre. */
  get vistoBuenoEnNombreDelJefe(): boolean {
    const p = this.props;
    return p.jefeEstado === 'aprobado' && p.jefeResueltoPor !== null && p.jefeResueltoPor !== p.jefeId;
  }

  /** Rechazo del jefe inmediato: cierra la solicitud sin pasar por Gestión Humana. */
  rechazarComoJefe(observacion: string | null, ahora: string): Permiso {
    this.exigirTurnoDelJefe();
    const obs = observacion?.trim() || null;
    return new Permiso({
      ...this.props,
      estado: 'rechazado',
      aprobadoPor: this.props.jefeId,
      observacionRespuesta: obs,
      jefeEstado: 'rechazado',
      jefeObservacion: obs,
      jefeFecha: ahora,
      jefeResueltoPor: this.props.jefeId,
      updatedAt: ahora,
    });
  }

  private exigirTurnoDelJefe(): void {
    if (!this.estaPendiente) throw new InvalidOperationError('La solicitud ya fue procesada.');
    if (this.props.jefeEstado !== 'pendiente') {
      throw new InvalidOperationError('El jefe inmediato ya respondió esta solicitud.');
    }
  }

  /** Marca como aprobada (Gestión Humana). Sólo las pendientes con visto bueno del jefe pueden procesarse. */
  aprobar(adminId: number, observacion: string | null, ahora: string): Permiso {
    return this.resolver('aprobado', adminId, observacion, ahora);
  }

  /** Marca como rechazada (Gestión Humana). Sólo las pendientes con visto bueno del jefe pueden procesarse. */
  rechazar(adminId: number, observacion: string | null, ahora: string): Permiso {
    return this.resolver('rechazado', adminId, observacion, ahora);
  }

  private resolver(estado: EstadoPermiso, adminId: number, observacion: string | null, ahora: string): Permiso {
    if (!this.estaPendiente) {
      throw new InvalidOperationError('La solicitud ya fue procesada.');
    }
    if (this.esperaJefe) {
      throw new InvalidOperationError('La solicitud aún espera el visto bueno del jefe inmediato.');
    }
    return new Permiso({
      ...this.props,
      estado,
      aprobadoPor: adminId,
      observacionRespuesta: observacion?.trim() || null,
      updatedAt: ahora,
    });
  }
}

/**
 * Normaliza una fecha u hora de entrada a `YYYY-MM-DD HH:mm:ss`.
 * Acepta `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, `YYYY-MM-DDTHH:mm:ss` y `YYYY-MM-DD HH:mm:ss`.
 * Devuelve null si no es válida.
 */
export function normalizarFechaHora(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  if (!m || parseIsoDate(m[1]) === null) return null;
  const hh = m[2] ?? '00';
  const mi = m[3] ?? '00';
  const ss = m[4] ?? '00';
  if (Number(hh) > 23 || Number(mi) > 59 || Number(ss) > 59) return null;
  return `${m[1]} ${hh}:${mi}:${ss}`;
}
