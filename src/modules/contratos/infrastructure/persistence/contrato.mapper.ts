import { Contrato } from '../../domain/contrato';
import { ContratoProrroga } from '../../domain/contrato-prorroga';
import { ContratoConColaborador, DatosColaborador } from '../../domain/repositories';
import { ContratoOrmEntity } from './contrato.orm-entity';
import { ContratoProrrogaOrmEntity } from './contrato-prorroga.orm-entity';

/** Columnas extra devueltas por los joins con `users`, `areas` y `cargos`. */
export interface ColaboradorRaw {
  first_name: string | null;
  last_name: string | null;
  cedula: string | null;
  codigo_empresa: string | null;
  area_nombre: string | null;
  cargo_nombre: string | null;
}

/** Los drivers pueden devolver `date` como Date o como string; normalizamos a `YYYY-MM-DD`. */
export function dateToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function toContrato(r: ContratoOrmEntity): Contrato {
  return Contrato.create({
    id: r.id,
    userId: r.user_id,
    tipoContrato: r.tipo_contrato,
    numeroContrato: r.numero_contrato,
    fechaInicio: dateToIso(r.fecha_inicio)!,
    fechaFin: dateToIso(r.fecha_fin),
    salarioBase: Number(r.salario_base),
    estado: r.estado,
    observaciones: r.observaciones,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  });
}

export function toColaborador(raw: Partial<ColaboradorRaw> | undefined): DatosColaborador {
  return {
    firstName: raw?.first_name ?? null,
    lastName: raw?.last_name ?? null,
    cedula: raw?.cedula ?? null,
    codigoEmpresa: raw?.codigo_empresa ?? null,
    areaNombre: raw?.area_nombre ?? null,
    cargoNombre: raw?.cargo_nombre ?? null,
  };
}

export function toContratoConColaborador(
  e: ContratoOrmEntity,
  raw: Partial<ColaboradorRaw> | undefined,
): ContratoConColaborador {
  return { contrato: toContrato(e), colaborador: toColaborador(raw) };
}

export function toOrmData(c: Contrato): Partial<ContratoOrmEntity> {
  const p = c.props;
  return {
    user_id: p.userId,
    tipo_contrato: p.tipoContrato,
    numero_contrato: p.numeroContrato,
    fecha_inicio: p.fechaInicio,
    fecha_fin: p.fechaFin,
    salario_base: p.salarioBase.toFixed(2),
    estado: p.estado,
    observaciones: p.observaciones,
  };
}

export function toProrroga(r: ContratoProrrogaOrmEntity): ContratoProrroga {
  return {
    id: r.id,
    contratoId: r.contrato_id,
    userId: r.user_id,
    fechaFinAnterior: dateToIso(r.fecha_fin_anterior)!,
    mesesProrroga: r.meses_prorroga,
    fechaInicioProrroga: dateToIso(r.fecha_inicio_prorroga)!,
    fechaFinNueva: dateToIso(r.fecha_fin_nueva)!,
    observacion: r.observacion,
    creadoPor: r.creado_por,
    createdAt: r.created_at ?? null,
  };
}
