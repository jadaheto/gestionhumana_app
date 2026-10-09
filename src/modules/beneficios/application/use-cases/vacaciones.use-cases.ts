import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import { DiasHabilesCalculator } from '../../domain/dias-habiles.calculator';
import { UsuariosPort } from '../../domain/ports';
import { PermisoRepository, VacacionesSuspensionRepository, VacacionRepository } from '../../domain/repositories';
import { VacacionesSaldoCalculator } from '../../domain/vacaciones-saldo';
import { ResumenVacacionesDto, VacacionDto } from '../dto/beneficios.dto';
import { toPermisoDto, toSuspensionDto, toVacacionDto } from '../mappers';

/**
 * Resumen de vacaciones de un usuario (saldo + solicitudes + suspensiones).
 * Un funcionario sólo puede consultar el suyo; el administrador, el de cualquiera.
 */
@Injectable()
export class GetResumenVacacionesUseCase implements UseCase<
  { actor: Actor; userId?: number | null },
  ResumenVacacionesDto
> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly suspensiones: VacacionesSuspensionRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
    private readonly saldoCalculator: VacacionesSaldoCalculator,
  ) {}

  async execute(input: { actor: Actor; userId?: number | null }): Promise<ResumenVacacionesDto> {
    const userId = input.userId ?? input.actor.id;
    if (userId !== input.actor.id && !isAdmin(input.actor)) {
      throw new ForbiddenError('Sólo puedes consultar tus propias vacaciones.');
    }
    if (userId !== input.actor.id && !(await this.usuarios.exists(userId))) {
      throw new NotFoundError('Colaborador', userId);
    }

    const [fechaReferencia, aprobadas, solicitudes, suspensiones] = await Promise.all([
      this.usuarios.findFechaIngresoReferencia(userId),
      this.permisos.findVacacionesAprobadas(userId),
      this.permisos.findVacacionesByUser(userId),
      this.suspensiones.findByUser(userId),
    ]);
    const ids = aprobadas.map((p) => p.id).filter((id): id is number => id !== null);
    const disfrutados = ids.length ? await this.suspensiones.findDiasDisfrutados(ids) : new Map<number, number>();
    const saldo = this.saldoCalculator.calcularSaldo({
      fechaReferencia,
      hoy: this.clock.today(),
      vacacionesAprobadas: aprobadas,
      diasDisfrutadosPorPermiso: disfrutados,
    });

    return {
      userId,
      fechaReferencia,
      saldo,
      solicitudes: solicitudes.map((p) => toPermisoDto(p, this.calculadora)),
      suspensiones: suspensiones.map(toSuspensionDto),
    };
  }
}

/** Períodos de vacaciones: el administrador ve todos (con colaborador); el funcionario sólo los suyos. */
@Injectable()
export class ListarVacacionesUseCase implements UseCase<Actor, VacacionDto[]> {
  constructor(private readonly vacaciones: VacacionRepository) {}

  async execute(actor: Actor): Promise<VacacionDto[]> {
    if (isAdmin(actor)) {
      return (await this.vacaciones.findAll()).map((r) => toVacacionDto(r.vacacion, r.colaborador));
    }
    return (await this.vacaciones.findByUser(actor.id)).map((v) => toVacacionDto(v));
  }
}
