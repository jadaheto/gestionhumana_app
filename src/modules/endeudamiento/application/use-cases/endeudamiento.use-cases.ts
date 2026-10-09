import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import {
  ColaboradorBasico,
  ColaboradorFinder,
  EndeudamientoRepository,
  SalarioReferenciaReader,
  SolicitudPersistida,
  SolicitudPersistidaConConceptos,
} from '../../domain/ports';
import { SolicitudEndeudamiento } from '../../domain/solicitud-endeudamiento';
import {
  ColaboradorBusquedaDto,
  CrearSolicitudInput,
  SalarioReferenciaDto,
  SiguienteNumeroDto,
  SolicitudDetalleDto,
  SolicitudResumenDto,
} from '../dto/endeudamiento.dto';

function nombreCompleto(c: ColaboradorBasico | null): string {
  return `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
}

export function toResumenDto(s: SolicitudPersistida): SolicitudResumenDto {
  return {
    id: s.id,
    solicitudNo: s.solicitudNo,
    userId: s.userId,
    colaborador: nombreCompleto(s.colaborador),
    cedula: s.colaborador?.cedula ?? null,
    fecha: s.fecha,
    porcentajeActual: s.porcentajeActual,
    porcentajeNuevoCredito: s.porcentajeNuevoCredito,
    umbralAprobacion: s.umbralAprobacion,
    estado: s.estado,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
  };
}

export function toDetalleDto(s: SolicitudPersistidaConConceptos): SolicitudDetalleDto {
  return {
    ...toResumenDto(s),
    anio: s.anio,
    libranza: s.libranza,
    salarioMensual: s.salarioMensual,
    otrosDevengados: s.otrosDevengados,
    totalDevengado: s.totalDevengado,
    totalDeducido: s.totalDeducido,
    netoActual: s.netoActual,
    deduccionesLey: s.deduccionesLey,
    deduccionesEndeudamiento: s.deduccionesEndeudamiento,
    valorSolicitado: s.valorSolicitado,
    plazoMeses: s.plazoMeses,
    cuotaMensual: s.cuotaMensual,
    valorQuincenal: s.valorQuincenal,
    netoRecibir: s.netoRecibir,
    opcionCredito: s.opcionCredito,
    conclusion: s.conclusion,
    conceptos: s.conceptos.map((c) => ({
      id: c.id,
      concepto: c.concepto,
      devengado: c.devengado,
      deducido: c.deducido,
      porcentaje: c.porcentaje,
      orden: c.orden,
    })),
  };
}

@Injectable()
export class ListSolicitudesUseCase implements UseCase<void, SolicitudResumenDto[]> {
  constructor(private readonly repo: EndeudamientoRepository) {}
  async execute(): Promise<SolicitudResumenDto[]> {
    return (await this.repo.findAll()).map(toResumenDto);
  }
}

@Injectable()
export class GetSolicitudUseCase implements UseCase<number, SolicitudDetalleDto> {
  constructor(private readonly repo: EndeudamientoRepository) {}
  async execute(id: number): Promise<SolicitudDetalleDto> {
    const s = await this.repo.findById(id);
    if (!s) throw new NotFoundError('Evaluación de endeudamiento', id);
    return toDetalleDto(s);
  }
}

/** `SOL-<año>-####` con consecutivo por año (igual que `generar_solicitud_no`). */
@Injectable()
export class GenerarNumeroSolicitudUseCase implements UseCase<{ anio?: number } | void, SiguienteNumeroDto> {
  constructor(
    private readonly repo: EndeudamientoRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input?: { anio?: number } | void): Promise<SiguienteNumeroDto> {
    const anio = (input && input.anio) || this.clock.now().getFullYear();
    const count = await this.repo.countByAnio(anio);
    return { solicitudNo: `SOL-${anio}-${String(count + 1).padStart(4, '0')}` };
  }
}

@Injectable()
export class CrearSolicitudUseCase implements UseCase<CrearSolicitudInput & { actor: Actor }, SolicitudDetalleDto> {
  constructor(
    private readonly repo: EndeudamientoRepository,
    private readonly colaboradores: ColaboradorFinder,
    private readonly numerador: GenerarNumeroSolicitudUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: CrearSolicitudInput & { actor: Actor }): Promise<SolicitudDetalleDto> {
    if (!Number.isInteger(input.userId) || input.userId <= 0 || !input.fecha) {
      throw new ValidationError('Debes seleccionar colaborador, fecha y número de solicitud.');
    }
    const colaborador = await this.colaboradores.findById(input.userId);
    if (!colaborador) throw new NotFoundError('Colaborador', input.userId);

    let solicitudNo = (input.solicitudNo ?? '').trim();
    if (solicitudNo === '') {
      const anio = Number(String(input.fecha).slice(0, 4)) || undefined;
      solicitudNo = (await this.numerador.execute({ anio })).solicitudNo;
    }

    const solicitud = SolicitudEndeudamiento.create({ ...input, solicitudNo });
    const id = await this.repo.save(solicitud, input.actor.id, this.clock.now());
    const guardada = await this.repo.findById(id);
    if (!guardada) throw new NotFoundError('Evaluación de endeudamiento', id);
    return toDetalleDto(guardada);
  }
}

/** Búsqueda de colaboradores con su salario de referencia (`buscar_colaborador`). */
@Injectable()
export class BuscarColaboradorUseCase implements UseCase<{ q?: string }, ColaboradorBusquedaDto[]> {
  constructor(
    private readonly colaboradores: ColaboradorFinder,
    private readonly salarios: SalarioReferenciaReader,
  ) {}
  async execute(input: { q?: string }): Promise<ColaboradorBusquedaDto[]> {
    const filas = await this.colaboradores.search((input.q ?? '').trim());
    const out: ColaboradorBusquedaDto[] = [];
    for (const c of filas) {
      out.push({
        id: c.id,
        nombre: nombreCompleto(c),
        cedula: c.cedula,
        codigo: c.codigoEmpresa,
        salario: await this.salarios.salarioReferencia(c.id),
      });
    }
    return out;
  }
}

@Injectable()
export class GetSalarioReferenciaUseCase implements UseCase<number, SalarioReferenciaDto> {
  constructor(
    private readonly colaboradores: ColaboradorFinder,
    private readonly salarios: SalarioReferenciaReader,
  ) {}
  async execute(userId: number): Promise<SalarioReferenciaDto> {
    if (!(await this.colaboradores.findById(userId))) throw new NotFoundError('Colaborador', userId);
    return { userId, salario: await this.salarios.salarioReferencia(userId) };
  }
}
