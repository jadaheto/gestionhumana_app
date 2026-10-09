import { Contrato, TIPOS_CONTRATO_NOMBRE } from '../../domain/contrato';
import { ContratoProrroga } from '../../domain/contrato-prorroga';
import { ContratoConColaborador, DatosColaborador } from '../../domain/repositories';
import { ContratoDto, ProrrogaDto } from '../dto/contratos.dto';

export function nombreCompleto(c: Pick<DatosColaborador, 'firstName' | 'lastName'>): string {
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
}

export function estadoNombre(estado: string): string {
  if (estado === 'finalizado') return 'Inactivo';
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

export function toContratoDto(row: ContratoConColaborador, hoy: string): ContratoDto {
  const c: Contrato = row.contrato;
  const p = c.props;
  return {
    id: p.id ?? 0,
    userId: p.userId,
    colaboradorNombre: nombreCompleto(row.colaborador),
    cedula: row.colaborador.cedula,
    cargoNombre: row.colaborador.cargoNombre,
    areaNombre: row.colaborador.areaNombre,
    tipoContrato: p.tipoContrato,
    tipoContratoNombre: TIPOS_CONTRATO_NOMBRE[p.tipoContrato],
    numeroContrato: p.numeroContrato,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    salarioBase: p.salarioBase,
    estado: p.estado,
    estadoNombre: estadoNombre(p.estado),
    observaciones: p.observaciones,
    diasParaVencer: c.diasParaVencer(hoy),
    puedeProrrogar: c.puedeProrrogar,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  };
}

export function toProrrogaDto(p: ContratoProrroga): ProrrogaDto {
  return {
    id: p.id ?? 0,
    contratoId: p.contratoId,
    fechaFinAnterior: p.fechaFinAnterior,
    mesesProrroga: p.mesesProrroga,
    fechaInicioProrroga: p.fechaInicioProrroga,
    fechaFinNueva: p.fechaFinNueva,
    observacion: p.observacion,
    creadoPor: p.creadoPor,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
  };
}
