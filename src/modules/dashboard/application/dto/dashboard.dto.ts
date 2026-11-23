import { AniversarioRow, CumpleaneroRow, DistribucionRow } from '../../domain/dashboard-queries.port';

export type CumpleaneroDto = CumpleaneroRow;
export type AniversarioDto = AniversarioRow;
export type DistribucionDto = DistribucionRow;

export interface ContratoPorVencerDto {
  id: number;
  userId: number;
  nombre: string;
  profileImage: string | null;
  tipoContrato: string;
  numeroContrato: string;
  fechaFin: string;
  /** Días calendario que faltan para el vencimiento (0 = vence hoy). */
  diasRestantes: number;
}

export interface DashboardAdminDto {
  rol: 'admin';
  hoy: string;
  estadisticas: {
    totalColaboradores: number;
    activos: number;
    inactivos: number;
    permisosPendientes: number;
  };
  contratosPorVencer: ContratoPorVencerDto[];
  porArea: DistribucionDto[];
  porSede: DistribucionDto[];
  cumpleaneros: CumpleaneroDto[];
  aniversarios: AniversarioDto[];
}

export interface DashboardFuncionarioDto {
  rol: 'funcionario';
  hoy: string;
  perfil: {
    nombre: string;
    profileImage: string | null;
    cargoNombre: string | null;
    areaNombre: string | null;
    fechaIngreso: string | null;
  };
  permisos: { total: number; pendientes: number };
  vacaciones: { periodos: number; diasAcumulados: number; diasConsumidos: number; diasPendientes: number };
  diasEnEmpresa: number;
  cumpleaneros: CumpleaneroDto[];
  aniversarios: AniversarioDto[];
}

export type DashboardDto = DashboardAdminDto | DashboardFuncionarioDto;
