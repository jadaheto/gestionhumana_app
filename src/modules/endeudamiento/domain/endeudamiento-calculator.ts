/**
 * Servicio de dominio puro con los cálculos de la evaluación de nivel de
 * endeudamiento. Replica `Endeudamiento::guardar` (PHP) y el `recalcular()`
 * de `endeudamiento_form.php` (JS) para que backend y formulario coincidan.
 */

export interface ConceptoInput {
  concepto: string;
  devengado: number;
  deducido: number;
}

export interface CalculoEndeudamientoInput {
  salarioMensual: number;
  otrosDevengados: number;
  deduccionesLey: number;
  conceptos: ConceptoInput[];
  cuotaMensual: number;
  /** Porcentaje máximo de endeudamiento permitido; si es <= 0 se usa 50. */
  umbralAprobacion: number;
}

export interface ConceptoCalculado extends ConceptoInput {
  /** `deducido / total devengado * 100`, redondeado a 2 decimales. */
  porcentaje: number;
}

export type NivelEndeudamiento = 'ZONA SEGURA' | 'CERCA DEL LIMITE' | 'SUPERA LIMITE';
export type EstadoEvaluacion = 'aprobado' | 'rechazado';

export interface CalculoEndeudamientoResult {
  totalDevengado: number;
  totalDeducido: number;
  netoActual: number;
  deduccionesEndeudamiento: number;
  porcentajeActual: number;
  valorQuincenal: number;
  porcentajeNuevoCredito: number;
  netoRecibir: number;
  umbralAprobacion: number;
  estado: EstadoEvaluacion;
  /** Semáforo del formulario: seguro / cerca del límite (>= 90 % del umbral) / supera el límite. */
  nivel: NivelEndeudamiento;
  conceptos: ConceptoCalculado[];
}

export const UMBRAL_POR_DEFECTO = 50;

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convierte cualquier entrada numérica (número, `"1.234,56"`, `"$ 1000"`, vacío) a número, como `to_decimal` del legado. */
export function aDecimal(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined) return 0;
  const texto = String(valor).trim();
  if (texto === '') return 0;
  const directo = Number(texto);
  if (Number.isFinite(directo)) return directo;
  const limpio = texto.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

/** Cuota mensual sugerida = valor solicitado / plazo (2 decimales); `null` si no es calculable. */
export function cuotaSugerida(valorSolicitado: number, plazoMeses: number): number | null {
  if (plazoMeses > 0 && valorSolicitado > 0) return redondear2(valorSolicitado / plazoMeses);
  return null;
}

export function calcularEndeudamiento(input: CalculoEndeudamientoInput): CalculoEndeudamientoResult {
  const salario = aDecimal(input.salarioMensual);
  const otros = aDecimal(input.otrosDevengados);
  const deduccionesLey = aDecimal(input.deduccionesLey);
  const cuota = aDecimal(input.cuotaMensual);
  let umbral = aDecimal(input.umbralAprobacion);
  if (umbral <= 0) umbral = UMBRAL_POR_DEFECTO;

  const conceptosLimpios = (input.conceptos ?? [])
    .map((c) => ({
      concepto: (c.concepto ?? '').trim(),
      devengado: aDecimal(c.devengado),
      deducido: aDecimal(c.deducido),
    }))
    .filter((c) => c.concepto !== '');

  const totalDevengado = salario + otros;
  const totalDeducido = conceptosLimpios.reduce((acc, c) => acc + c.deducido, 0);
  const base = totalDevengado > 0 ? totalDevengado : 1;

  const porcentajeActualBruto = (totalDeducido / base) * 100;
  const porcentajeNuevoBruto = ((totalDeducido + cuota) / base) * 100;
  const ratio = umbral > 0 ? porcentajeNuevoBruto / umbral : 0;

  let nivel: NivelEndeudamiento = 'ZONA SEGURA';
  if (porcentajeNuevoBruto > umbral) nivel = 'SUPERA LIMITE';
  else if (ratio >= 0.9) nivel = 'CERCA DEL LIMITE';

  return {
    totalDevengado: redondear2(totalDevengado),
    totalDeducido: redondear2(totalDeducido),
    netoActual: redondear2(totalDevengado - totalDeducido),
    deduccionesEndeudamiento: redondear2(Math.max(totalDeducido - deduccionesLey, 0)),
    porcentajeActual: redondear2(porcentajeActualBruto),
    valorQuincenal: redondear2(cuota / 2),
    porcentajeNuevoCredito: redondear2(porcentajeNuevoBruto),
    netoRecibir: redondear2(totalDevengado - (totalDeducido + cuota)),
    umbralAprobacion: umbral,
    estado: porcentajeNuevoBruto <= umbral ? 'aprobado' : 'rechazado',
    nivel,
    conceptos: conceptosLimpios.map((c) => ({ ...c, porcentaje: redondear2((c.deducido / base) * 100) })),
  };
}
