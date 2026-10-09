import { DiasHabilesCalculator } from '../domain/dias-habiles.calculator';
import { Incapacidad } from '../domain/incapacidad';
import { Permiso } from '../domain/permiso';
import { SuspensionConRango } from '../domain/repositories';
import { Vacacion } from '../domain/vacacion';
import { IncapacidadDto, PermisoDto, SuspensionVacacionesDto, VacacionDto } from './dto/beneficios.dto';

export function toPermisoDto(
  permiso: Permiso,
  calculadora: DiasHabilesCalculator,
  nombres: { colaborador?: string | null; aprobador?: string | null } = {},
): PermisoDto {
  const p = permiso.props;
  return {
    id: p.id ?? 0,
    userId: p.userId,
    tipoPermiso: p.tipoPermiso,
    fechaSolicitud: p.fechaSolicitud,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    horas: p.horas,
    justificacion: p.justificacion,
    archivoSoporte: p.archivoSoporte,
    estado: p.estado,
    aprobadoPor: p.aprobadoPor,
    observacionRespuesta: p.observacionRespuesta,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    diasHabiles: calculadora.calcularDiasHabiles(p.fechaInicio, p.fechaFin),
    colaborador: nombres.colaborador ?? null,
    aprobador: nombres.aprobador ?? null,
  };
}

export function toSuspensionDto(item: SuspensionConRango): SuspensionVacacionesDto {
  const s = item.suspension.props;
  return {
    id: s.id ?? 0,
    permisoId: s.permisoId,
    userId: s.userId,
    diasTotales: s.diasTotales,
    diasDisfrutados: s.diasDisfrutados,
    diasReintegrados: s.diasReintegrados,
    motivo: s.motivo,
    suspendidoPor: s.suspendidoPor,
    fechaSuspension: s.fechaSuspension,
    fechaInicio: item.fechaInicio,
    fechaFin: item.fechaFin,
  };
}

export function toIncapacidadDto(incapacidad: Incapacidad, colaborador: string | null = null): IncapacidadDto {
  const i = incapacidad.props;
  return {
    id: i.id ?? 0,
    userId: i.userId,
    tipo: i.tipo,
    fechaInicio: i.fechaInicio,
    fechaFin: i.fechaFin,
    dias: i.dias,
    entidadEmisora: i.entidadEmisora,
    numeroIncapacidad: i.numeroIncapacidad,
    archivoSoporte: i.archivoSoporte,
    estado: i.estado,
    createdAt: i.createdAt,
    colaborador,
  };
}

export function toVacacionDto(v: Vacacion, colaborador: string | null = null): VacacionDto {
  return { ...v, colaborador };
}

/** "Calamidad Doméstica" ← "calamidad_domestica" (equivale a `ucwords(str_replace('_',' ', …))`). */
export function tipoLegible(tipo: string): string {
  return tipo
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
