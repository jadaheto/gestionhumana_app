import { ValidationError } from '../../../shared/domain/domain-error';
import { diferenciaDias, esFechaIso, sumar } from './fechas';

/** Tipos de contrato (columna `contratos.tipo_contrato`). */
export const TIPOS_CONTRATO = ['indefinido', 'fijo', 'prestacion_servicios', 'obra_labor', 'aprendizaje'] as const;
export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

export const TIPOS_CONTRATO_NOMBRE: Record<TipoContrato, string> = {
  indefinido: 'Indefinido',
  fijo: 'Fijo',
  prestacion_servicios: 'Prestación de servicios',
  obra_labor: 'Obra o labor',
  aprendizaje: 'Aprendizaje',
};

/** Estados del contrato (columna `contratos.estado`). */
export const ESTADOS_CONTRATO = ['activo', 'finalizado', 'renovado'] as const;
export type EstadoContrato = (typeof ESTADOS_CONTRATO)[number];

export interface ContratoProps {
  id: number | null;
  userId: number;
  tipoContrato: TipoContrato;
  numeroContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  estado: EstadoContrato;
  observaciones: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type CreateContratoProps = Omit<
  ContratoProps,
  'id' | 'estado' | 'createdAt' | 'updatedAt' | 'tipoContrato' | 'fechaFin' | 'observaciones'
> & {
  id?: number | null;
  tipoContrato: string;
  fechaFin?: string | null;
  estado?: string | null;
  observaciones?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/**
 * Agregado Contrato. Las invariantes se validan en `create()`; las
 * transiciones de estado (finalizar, prorrogar) devuelven nuevas instancias.
 */
export class Contrato {
  private constructor(readonly props: ContratoProps) {}

  static create(input: CreateContratoProps): Contrato {
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
      throw new ValidationError('Debes seleccionar un colaborador.');
    }
    if (!(TIPOS_CONTRATO as readonly string[]).includes(input.tipoContrato)) {
      throw new ValidationError('El tipo de contrato no es válido.');
    }
    const numero = (input.numeroContrato ?? '').trim();
    if (numero === '') throw new ValidationError('El número de contrato es obligatorio.');
    if (numero.length > 50) throw new ValidationError('El número de contrato no puede superar 50 caracteres.');
    if (!esFechaIso(input.fechaInicio)) throw new ValidationError('La fecha de inicio no es válida (AAAA-MM-DD).');
    const fechaFin = input.fechaFin ? input.fechaFin : null;
    if (fechaFin !== null && !esFechaIso(fechaFin))
      throw new ValidationError('La fecha fin no es válida (AAAA-MM-DD).');
    if (fechaFin !== null && diferenciaDias(input.fechaInicio, fechaFin) < 0) {
      throw new ValidationError('La fecha fin no puede ser anterior a la fecha de inicio.');
    }
    const salario = Number(input.salarioBase);
    if (!Number.isFinite(salario) || salario <= 0)
      throw new ValidationError('El salario base debe ser mayor que cero.');
    const estado = input.estado ? input.estado : 'activo';
    if (!(ESTADOS_CONTRATO as readonly string[]).includes(estado))
      throw new ValidationError('El estado del contrato no es válido.');

    return new Contrato({
      id: input.id ?? null,
      userId: input.userId,
      tipoContrato: input.tipoContrato as TipoContrato,
      numeroContrato: numero,
      fechaInicio: input.fechaInicio,
      fechaFin,
      salarioBase: Math.round(salario * 100) / 100,
      estado: estado as EstadoContrato,
      observaciones: input.observaciones?.trim() || null,
      createdAt: input.createdAt ?? null,
      updatedAt: input.updatedAt ?? null,
    });
  }

  get id(): number | null {
    return this.props.id;
  }

  withId(id: number): Contrato {
    return new Contrato({ ...this.props, id });
  }

  /** Días que faltan para el vencimiento (negativo si ya venció; null si es indefinido). */
  diasParaVencer(hoy: string): number | null {
    return this.props.fechaFin ? diferenciaDias(hoy, this.props.fechaFin) : null;
  }

  /** Regla `sync_expired_contracts`: activo con fecha fin anterior a hoy. */
  estaVencido(hoy: string): boolean {
    return (
      this.props.estado === 'activo' && this.props.fechaFin !== null && diferenciaDias(hoy, this.props.fechaFin) < 0
    );
  }

  /** Regla `has_active_contract`: activo y vigente hoy. */
  estaVigente(hoy: string): boolean {
    return (
      this.props.estado === 'activo' &&
      diferenciaDias(this.props.fechaInicio, hoy) >= 0 &&
      (this.props.fechaFin === null || diferenciaDias(hoy, this.props.fechaFin) >= 0)
    );
  }

  /** Solo pueden prorrogarse contratos activos con fecha fin definida (igual que el botón del legado). */
  get puedeProrrogar(): boolean {
    return this.props.estado === 'activo' && this.props.fechaFin !== null;
  }

  finalizar(): Contrato {
    return new Contrato({ ...this.props, estado: 'finalizado' });
  }

  /**
   * Calcula la prórroga igual que `registrar_prorroga`: inicio = fin + 1 día,
   * nueva fecha fin = inicio + N meses - 1 día. El contrato queda activo.
   */
  prorrogar(meses: number): {
    contrato: Contrato;
    fechaFinAnterior: string;
    fechaInicioProrroga: string;
    fechaFinNueva: string;
    meses: number;
  } {
    if (!this.props.fechaFin) throw new ValidationError('Contrato inválido o sin fecha fin.');
    if (!Number.isInteger(meses) || meses <= 0) {
      throw new ValidationError('Debes indicar una cantidad de meses válida para la prórroga.');
    }
    const fechaFinAnterior = this.props.fechaFin;
    const fechaInicioProrroga = sumar(fechaFinAnterior, { dias: 1 });
    const fechaFinNueva = sumar(fechaInicioProrroga, { meses, dias: -1 });
    const contrato = new Contrato({ ...this.props, fechaFin: fechaFinNueva, estado: 'activo' });
    return { contrato, fechaFinAnterior, fechaInicioProrroga, fechaFinNueva, meses };
  }
}
