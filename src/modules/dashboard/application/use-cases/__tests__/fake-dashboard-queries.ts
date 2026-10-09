import {
  AniversarioRow,
  ContratoPorVencerRow,
  CumpleaneroRow,
  DashboardQueries,
  DistribucionRow,
  PerfilRow,
  TopPuntoRow,
  VacacionAprobadaRow,
} from '../../../domain/dashboard-queries.port';

/** Doble en memoria del puerto de consultas del dashboard. */
export class FakeDashboardQueries extends DashboardQueries {
  colaboradores = { total: 0, activo: 0, inactivo: 0 };
  permisosPendientes = 0;
  contratos: ContratoPorVencerRow[] = [];
  puntos: TopPuntoRow[] = [];
  porArea: DistribucionRow[] = [];
  porSede: DistribucionRow[] = [];
  cumpleaneros: CumpleaneroRow[] = [];
  aniversarios: AniversarioRow[] = [];
  perfil: PerfilRow | null = null;
  misPermisos = { total: 0, pendiente: 0 };
  vacaciones: VacacionAprobadaRow[] = [];
  llamadas: string[] = [];

  countColaboradores(estado?: 'activo' | 'inactivo'): Promise<number> {
    this.llamadas.push(`countColaboradores:${estado ?? 'todos'}`);
    return Promise.resolve(estado ? this.colaboradores[estado] : this.colaboradores.total);
  }
  countPermisosPendientes(): Promise<number> {
    return Promise.resolve(this.permisosPendientes);
  }
  contratosPorVencer(hoy: string, dias: number): Promise<ContratoPorVencerRow[]> {
    this.llamadas.push(`contratosPorVencer:${hoy}:${dias}`);
    return Promise.resolve(this.contratos);
  }
  topPuntos(): Promise<TopPuntoRow[]> {
    return Promise.resolve(this.puntos);
  }
  colaboradoresPorArea(): Promise<DistribucionRow[]> {
    return Promise.resolve(this.porArea);
  }
  colaboradoresPorSede(): Promise<DistribucionRow[]> {
    return Promise.resolve(this.porSede);
  }
  cumpleanerosHoy(): Promise<CumpleaneroRow[]> {
    return Promise.resolve(this.cumpleaneros);
  }
  aniversariosHoy(): Promise<AniversarioRow[]> {
    return Promise.resolve(this.aniversarios);
  }
  perfilUsuario(): Promise<PerfilRow | null> {
    this.llamadas.push('perfilUsuario');
    return Promise.resolve(this.perfil);
  }
  countMisPermisos(_userId: number, estado?: 'pendiente'): Promise<number> {
    return Promise.resolve(estado ? this.misPermisos.pendiente : this.misPermisos.total);
  }
  vacacionesAprobadas(): Promise<VacacionAprobadaRow[]> {
    return Promise.resolve(this.vacaciones);
  }
}
