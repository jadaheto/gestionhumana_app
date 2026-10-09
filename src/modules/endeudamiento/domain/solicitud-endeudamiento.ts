import { ValidationError } from '../../../shared/domain/domain-error';
import {
  aDecimal,
  calcularEndeudamiento,
  CalculoEndeudamientoResult,
  ConceptoCalculado,
  ConceptoInput,
} from './endeudamiento-calculator';

export interface SolicitudEndeudamientoProps {
  id: number | null;
  userId: number;
  solicitudNo: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  anio: number;
  libranza: string | null;
  salarioMensual: number;
  otrosDevengados: number;
  deduccionesLey: number;
  valorSolicitado: number;
  plazoMeses: number;
  cuotaMensual: number;
  opcionCredito: string | null;
  conclusion: string;
  calculo: CalculoEndeudamientoResult;
}

export interface NuevaSolicitudProps {
  id?: number | null;
  userId: number;
  solicitudNo: string;
  fecha: string;
  libranza?: string | null;
  salarioMensual: number;
  otrosDevengados?: number;
  deduccionesLey?: number;
  umbralAprobacion?: number;
  conceptos: ConceptoInput[];
  valorSolicitado?: number;
  plazoMeses?: number;
  cuotaMensual?: number;
  opcionCredito?: string | null;
  /** Conclusión manual; si está vacía se usa el estado calculado (APROBADO/RECHAZADO). */
  conclusion?: string | null;
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function noNegativo(valor: unknown, campo: string): number {
  const n = aDecimal(valor);
  if (n < 0) throw new ValidationError(`El campo ${campo} no puede ser negativo.`);
  return n;
}

/** Agregado: evaluación de nivel de endeudamiento de un colaborador. */
export class SolicitudEndeudamiento {
  private constructor(readonly props: SolicitudEndeudamientoProps) {}

  static create(p: NuevaSolicitudProps): SolicitudEndeudamiento {
    if (!Number.isInteger(p.userId) || p.userId <= 0) throw new ValidationError('Debes seleccionar un colaborador.');
    const solicitudNo = (p.solicitudNo ?? '').trim();
    if (solicitudNo === '') throw new ValidationError('El número de solicitud es obligatorio.');
    if (solicitudNo.length > 50) throw new ValidationError('El número de solicitud no puede superar 50 caracteres.');
    const fecha = (p.fecha ?? '').trim();
    if (!FECHA_REGEX.test(fecha) || Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
      throw new ValidationError('La fecha debe tener formato YYYY-MM-DD.');
    }
    const plazo = Math.trunc(aDecimal(p.plazoMeses ?? 0));
    if (plazo < 0) throw new ValidationError('El plazo en meses no puede ser negativo.');

    const salarioMensual = noNegativo(p.salarioMensual, 'salario mensual');
    const otrosDevengados = noNegativo(p.otrosDevengados ?? 0, 'otros devengados');
    const deduccionesLey = noNegativo(p.deduccionesLey ?? 0, 'deducciones de ley');
    const valorSolicitado = noNegativo(p.valorSolicitado ?? 0, 'valor solicitado');
    const cuotaMensual = noNegativo(p.cuotaMensual ?? 0, 'cuota mensual');
    for (const c of p.conceptos ?? []) {
      noNegativo(c.devengado, `devengado de ${c.concepto || 'concepto'}`);
      noNegativo(c.deducido, `deducido de ${c.concepto || 'concepto'}`);
    }

    const calculo = calcularEndeudamiento({
      salarioMensual,
      otrosDevengados,
      deduccionesLey,
      conceptos: p.conceptos ?? [],
      cuotaMensual,
      umbralAprobacion: aDecimal(p.umbralAprobacion ?? 0),
    });

    const conclusionManual = (p.conclusion ?? '').trim().toUpperCase();
    return new SolicitudEndeudamiento({
      id: p.id ?? null,
      userId: p.userId,
      solicitudNo,
      fecha,
      anio: Number(fecha.slice(0, 4)),
      libranza: (p.libranza ?? '').trim().slice(0, 100) || null,
      salarioMensual,
      otrosDevengados,
      deduccionesLey,
      valorSolicitado,
      plazoMeses: plazo,
      cuotaMensual,
      opcionCredito: (p.opcionCredito ?? '').trim().slice(0, 10) || null,
      conclusion: conclusionManual !== '' ? conclusionManual : calculo.estado.toUpperCase(),
      calculo,
    });
  }

  get id() {
    return this.props.id;
  }
  get estado() {
    return this.props.calculo.estado;
  }
  get conceptos(): ConceptoCalculado[] {
    return this.props.calculo.conceptos;
  }

  withId(id: number): SolicitudEndeudamiento {
    return new SolicitudEndeudamiento({ ...this.props, id });
  }
}
