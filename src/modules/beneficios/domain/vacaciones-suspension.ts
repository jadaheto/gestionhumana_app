import { InvalidOperationError, ValidationError } from '../../../shared/domain/domain-error';
import { DiasHabilesCalculator } from './dias-habiles.calculator';
import { Permiso } from './permiso';

export interface VacacionesSuspensionProps {
  id: number | null;
  permisoId: number;
  userId: number;
  diasTotales: number;
  diasDisfrutados: number;
  diasReintegrados: number;
  motivo: string | null;
  suspendidoPor: number;
  /** `YYYY-MM-DD HH:mm:ss` */
  fechaSuspension: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RegistrarSuspensionInput {
  permiso: Permiso;
  diasDisfrutados: number;
  motivo: string | null;
  adminId: number;
  /** Fecha-hora de la suspensión (`YYYY-MM-DD HH:mm:ss`). */
  ahora: string;
  calculadora: DiasHabilesCalculator;
  /** Suspensión previa del mismo permiso (se actualiza en lugar de duplicar). */
  existente?: VacacionesSuspension | null;
}

/**
 * Suspensión de unas vacaciones aprobadas (tabla `vacaciones_suspensiones`).
 * Los días no disfrutados se reintegran al saldo del colaborador.
 * Reglas migradas de `Vacaciones_model::suspender_vacaciones_aprobadas`.
 */
export class VacacionesSuspension {
  private constructor(readonly props: VacacionesSuspensionProps) {}

  static registrar(input: RegistrarSuspensionInput): VacacionesSuspension {
    const { permiso } = input;
    if (permiso.id === null || !permiso.esVacaciones || permiso.estado !== 'aprobado') {
      throw new InvalidOperationError('Solo se pueden suspender vacaciones aprobadas.');
    }
    const diasTotales = input.calculadora.calcularDiasHabiles(permiso.props.fechaInicio, permiso.props.fechaFin);
    if (diasTotales <= 0) {
      throw new InvalidOperationError('La solicitud no tiene días hábiles de vacaciones.');
    }
    const disfrutados = Math.trunc(Number(input.diasDisfrutados));
    if (!Number.isFinite(disfrutados) || disfrutados <= 0) {
      throw new ValidationError('Debes indicar al menos 1 día disfrutado.');
    }
    if (disfrutados > diasTotales) {
      throw new ValidationError('Los días disfrutados no pueden superar los días aprobados.');
    }
    return new VacacionesSuspension({
      id: input.existente?.id ?? null,
      permisoId: permiso.id,
      userId: permiso.userId,
      diasTotales,
      diasDisfrutados: disfrutados,
      diasReintegrados: diasTotales - disfrutados,
      motivo: input.motivo?.trim() || null,
      suspendidoPor: input.adminId,
      fechaSuspension: input.ahora,
      createdAt: input.existente?.props.createdAt ?? null,
      updatedAt: input.ahora,
    });
  }

  static rehydrate(props: VacacionesSuspensionProps): VacacionesSuspension {
    return new VacacionesSuspension(props);
  }

  get id(): number | null {
    return this.props.id;
  }

  withId(id: number): VacacionesSuspension {
    return new VacacionesSuspension({ ...this.props, id });
  }
}
