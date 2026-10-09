import { DiasHabilesCalculator, parseIsoDate } from './dias-habiles.calculator';
import { Permiso } from './permiso';

/** Días hábiles de vacaciones que se acumulan por cada período (año) cumplido. */
export const DIAS_VACACIONES_POR_PERIODO = 15;

export interface SaldoVacaciones {
  periodos: number;
  diasAcumulados: number;
  diasConsumidos: number;
  diasPendientes: number;
}

/**
 * Servicio de dominio puro para el saldo de vacaciones.
 * Reglas migradas de `Vacaciones_model::get_saldo_resumen`:
 * - Se acumulan 15 días hábiles por cada año cumplido desde la fecha de ingreso de referencia.
 * - Se consumen los días hábiles de las vacaciones aprobadas; si una fue suspendida,
 *   sólo cuentan los días efectivamente disfrutados.
 * - No se permiten vacaciones anticipadas (el saldo nunca es negativo).
 */
export class VacacionesSaldoCalculator {
  constructor(private readonly calculadora: DiasHabilesCalculator) {}

  /** Años completos transcurridos entre la fecha de referencia y hoy (0 si no hay fecha o es futura). */
  periodosCumplidos(fechaReferencia: string | null | undefined, hoy: string): number {
    const ref = parseIsoDate(fechaReferencia);
    const h = parseIsoDate(hoy);
    if (ref === null || h === null || h < ref) return 0;
    const r = new Date(ref);
    const d = new Date(h);
    let years = d.getUTCFullYear() - r.getUTCFullYear();
    const antesDelAniversario =
      d.getUTCMonth() < r.getUTCMonth() || (d.getUTCMonth() === r.getUTCMonth() && d.getUTCDate() < r.getUTCDate());
    if (antesDelAniversario) years--;
    return Math.max(0, years);
  }

  /**
   * Días consumidos por vacaciones aprobadas. `diasDisfrutadosPorPermiso` contiene,
   * para los permisos suspendidos, los días realmente disfrutados.
   */
  diasConsumidos(vacacionesAprobadas: Permiso[], diasDisfrutadosPorPermiso: ReadonlyMap<number, number>): number {
    let total = 0;
    for (const p of vacacionesAprobadas) {
      let dias = this.calculadora.calcularDiasHabiles(p.props.fechaInicio, p.props.fechaFin);
      const disfrutados = p.id !== null ? diasDisfrutadosPorPermiso.get(p.id) : undefined;
      if (disfrutados !== undefined) {
        dias = Math.max(0, Math.min(dias, disfrutados));
      }
      total += dias;
    }
    return total;
  }

  calcularSaldo(input: {
    fechaReferencia: string | null;
    hoy: string;
    vacacionesAprobadas: Permiso[];
    diasDisfrutadosPorPermiso: ReadonlyMap<number, number>;
  }): SaldoVacaciones {
    const periodos = this.periodosCumplidos(input.fechaReferencia, input.hoy);
    const diasAcumulados = periodos * DIAS_VACACIONES_POR_PERIODO;
    const diasConsumidos = this.diasConsumidos(input.vacacionesAprobadas, input.diasDisfrutadosPorPermiso);
    return {
      periodos,
      diasAcumulados,
      diasConsumidos,
      diasPendientes: Math.max(0, diasAcumulados - diasConsumidos),
    };
  }
}
