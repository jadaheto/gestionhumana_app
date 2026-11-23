import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { aniosCumplidos, diasEntre, diasHabilesAproximados } from '../../domain/calculos-fecha';
import { DashboardQueries } from '../../domain/dashboard-queries.port';
import { DashboardAdminDto, DashboardDto, DashboardFuncionarioDto } from '../dto/dashboard.dto';

/** Ventana de días para "contratos por vencer" (igual que `Rrhh::dashboard`). */
export const DIAS_CONTRATOS_POR_VENCER = 30;
export const LIMITE_CONTRATOS_POR_VENCER = 10;
/** Días de vacaciones que se causan por cada año cumplido (Ley colombiana). */
export const DIAS_VACACIONES_POR_PERIODO = 15;

/**
 * Construye el payload del dashboard según el rol del actor, replicando
 * `Rrhh::dashboard()` del legado.
 */
@Injectable()
export class GetDashboardUseCase implements UseCase<Actor, DashboardDto> {
  constructor(
    private readonly queries: DashboardQueries,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Actor): Promise<DashboardDto> {
    const hoy = this.clock.today();
    const [cumpleaneros, aniversarios] = await Promise.all([
      this.queries.cumpleanerosHoy(hoy),
      this.queries.aniversariosHoy(hoy),
    ]);
    return isAdmin(actor)
      ? this.admin(hoy, cumpleaneros, aniversarios)
      : this.funcionario(actor.id, hoy, cumpleaneros, aniversarios);
  }

  private async admin(
    hoy: string,
    cumpleaneros: DashboardAdminDto['cumpleaneros'],
    aniversarios: DashboardAdminDto['aniversarios'],
  ): Promise<DashboardAdminDto> {
    const [total, activos, inactivos, permisosPendientes, contratos, porArea, porSede] = await Promise.all([
      this.queries.countColaboradores(),
      this.queries.countColaboradores('activo'),
      this.queries.countColaboradores('inactivo'),
      this.queries.countPermisosPendientes(),
      this.queries.contratosPorVencer(hoy, DIAS_CONTRATOS_POR_VENCER, LIMITE_CONTRATOS_POR_VENCER),
      this.queries.colaboradoresPorArea(),
      this.queries.colaboradoresPorSede(),
    ]);
    return {
      rol: 'admin',
      hoy,
      estadisticas: { totalColaboradores: total, activos, inactivos, permisosPendientes },
      contratosPorVencer: contratos.map((c) => ({ ...c, diasRestantes: Math.max(0, diasEntre(hoy, c.fechaFin)) })),
      porArea,
      porSede,
      cumpleaneros,
      aniversarios,
    };
  }

  private async funcionario(
    userId: number,
    hoy: string,
    cumpleaneros: DashboardFuncionarioDto['cumpleaneros'],
    aniversarios: DashboardFuncionarioDto['aniversarios'],
  ): Promise<DashboardFuncionarioDto> {
    const [perfil, permisosTotal, permisosPendientes, vacacionesAprobadas] = await Promise.all([
      this.queries.perfilUsuario(userId),
      this.queries.countMisPermisos(userId),
      this.queries.countMisPermisos(userId, 'pendiente'),
      this.queries.vacacionesAprobadas(userId),
    ]);

    const fechaIngreso = perfil?.fechaIngreso ?? null;
    const diasEnEmpresa = fechaIngreso ? Math.max(0, diasEntre(fechaIngreso, hoy)) : 0;

    // Saldo de vacaciones (Vacaciones_model::get_saldo_resumen): períodos cumplidos × 15
    // menos días hábiles consumidos en vacaciones aprobadas (acotados por la suspensión).
    const periodos = fechaIngreso ? aniosCumplidos(fechaIngreso, hoy) : 0;
    const diasAcumulados = periodos * DIAS_VACACIONES_POR_PERIODO;
    const diasConsumidos = vacacionesAprobadas.reduce((acc, v) => {
      let dias = diasHabilesAproximados(v.fechaInicio, v.fechaFin);
      if (v.diasDisfrutadosSuspension !== null) dias = Math.max(0, Math.min(dias, v.diasDisfrutadosSuspension));
      return acc + dias;
    }, 0);

    return {
      rol: 'funcionario',
      hoy,
      perfil: {
        nombre: perfil?.nombre ?? '',
        profileImage: perfil?.profileImage ?? null,
        cargoNombre: perfil?.cargoNombre ?? null,
        areaNombre: perfil?.areaNombre ?? null,
        fechaIngreso,
      },
      permisos: { total: permisosTotal, pendientes: permisosPendientes },
      vacaciones: {
        periodos,
        diasAcumulados,
        diasConsumidos,
        diasPendientes: Math.max(0, diasAcumulados - diasConsumidos),
      },
      diasEnEmpresa,
      cumpleaneros,
      aniversarios,
    };
  }
}
