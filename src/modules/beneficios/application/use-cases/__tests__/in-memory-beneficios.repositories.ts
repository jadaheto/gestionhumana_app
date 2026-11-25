import { Incapacidad } from '../../../domain/incapacidad';
import { Permiso } from '../../../domain/permiso';
import { ColaboradorResumen, NotificacionesPort, NuevaNotificacion, UsuariosPort } from '../../../domain/ports';
import {
  FiltroPermisos,
  IncapacidadConNombre,
  IncapacidadRepository,
  PermisoConNombres,
  PermisoRepository,
  SuspensionConRango,
  VacacionConNombre,
  VacacionesSuspensionRepository,
  VacacionRepository,
} from '../../../domain/repositories';
import { Vacacion, VacacionDetalle } from '../../../domain/vacacion';
import { VacacionesSuspension } from '../../../domain/vacaciones-suspension';

/** Dobles en memoria de los puertos del módulo, para tests de casos de uso. */

export class InMemoryPermisoRepository extends PermisoRepository {
  items: Permiso[] = [];
  nombres = new Map<number, string>();
  private seq = 1;

  findById(id: number): Promise<Permiso | null> {
    return Promise.resolve(this.items.find((p) => p.id === id) ?? null);
  }
  findByUser(userId: number): Promise<Permiso[]> {
    return Promise.resolve([...this.items.filter((p) => p.userId === userId)].reverse());
  }
  findAll(filtro: FiltroPermisos = {}): Promise<PermisoConNombres[]> {
    return Promise.resolve(
      [...this.items]
        .reverse()
        .filter((p) => !filtro.estado || p.estado === filtro.estado)
        .filter((p) => !filtro.jefeId || p.props.jefeId === filtro.jefeId)
        .filter((p) => !filtro.jefeEstado || p.props.jefeEstado === filtro.jefeEstado)
        .map((permiso) => ({
          permiso,
          colaborador: this.nombres.get(permiso.userId) ?? `Usuario ${permiso.userId}`,
          aprobador: permiso.props.aprobadoPor ? (this.nombres.get(permiso.props.aprobadoPor) ?? null) : null,
          jefe: permiso.props.jefeId ? (this.nombres.get(permiso.props.jefeId) ?? null) : null,
        })),
    );
  }
  findVacacionesAprobadas(userId: number, excluirPermisoId: number | null = null): Promise<Permiso[]> {
    return Promise.resolve(
      this.items.filter(
        (p) => p.userId === userId && p.esVacaciones && p.estado === 'aprobado' && p.id !== excluirPermisoId,
      ),
    );
  }
  findVacacionesByUser(userId: number): Promise<Permiso[]> {
    return Promise.resolve([...this.items.filter((p) => p.userId === userId && p.esVacaciones)].reverse());
  }
  save(permiso: Permiso): Promise<Permiso> {
    if (permiso.id) {
      this.items = this.items.map((p) => (p.id === permiso.id ? permiso : p));
      return Promise.resolve(permiso);
    }
    const saved = permiso.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}

export class InMemorySuspensionRepository extends VacacionesSuspensionRepository {
  items: VacacionesSuspension[] = [];
  rangos = new Map<number, { fechaInicio: string; fechaFin: string }>();
  private seq = 1;

  findByPermiso(permisoId: number): Promise<VacacionesSuspension | null> {
    return Promise.resolve(this.items.find((s) => s.props.permisoId === permisoId) ?? null);
  }
  findDiasDisfrutados(permisoIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    for (const s of this.items) {
      if (permisoIds.includes(s.props.permisoId)) map.set(s.props.permisoId, s.props.diasDisfrutados);
    }
    return Promise.resolve(map);
  }
  findByUser(userId: number): Promise<SuspensionConRango[]> {
    return Promise.resolve(
      this.items
        .filter((s) => s.props.userId === userId)
        .map((suspension) => ({
          suspension,
          fechaInicio: this.rangos.get(suspension.props.permisoId)?.fechaInicio ?? null,
          fechaFin: this.rangos.get(suspension.props.permisoId)?.fechaFin ?? null,
        })),
    );
  }
  save(suspension: VacacionesSuspension): Promise<VacacionesSuspension> {
    if (suspension.id) {
      this.items = this.items.map((s) => (s.id === suspension.id ? suspension : s));
      return Promise.resolve(suspension);
    }
    const saved = suspension.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}

export class InMemoryIncapacidadRepository extends IncapacidadRepository {
  items: Incapacidad[] = [];
  private seq = 1;

  findByUser(userId: number): Promise<Incapacidad[]> {
    return Promise.resolve(this.items.filter((i) => i.props.userId === userId));
  }
  findAll(): Promise<IncapacidadConNombre[]> {
    return Promise.resolve(
      this.items.map((incapacidad) => ({ incapacidad, colaborador: `Usuario ${incapacidad.props.userId}` })),
    );
  }
  save(incapacidad: Incapacidad): Promise<Incapacidad> {
    const saved = incapacidad.withId(this.seq++);
    this.items.push(saved);
    return Promise.resolve(saved);
  }
}

export class InMemoryVacacionRepository extends VacacionRepository {
  items: Vacacion[] = [];
  detalles: VacacionDetalle[] = [];

  findByUser(userId: number): Promise<Vacacion[]> {
    return Promise.resolve(this.items.filter((v) => v.userId === userId));
  }
  findAll(): Promise<VacacionConNombre[]> {
    return Promise.resolve(this.items.map((vacacion) => ({ vacacion, colaborador: `Usuario ${vacacion.userId}` })));
  }
  findDetalles(vacacionIds: number[]): Promise<VacacionDetalle[]> {
    return Promise.resolve(this.detalles.filter((d) => vacacionIds.includes(d.vacacionId)));
  }
}

export class FakeUsuariosPort extends UsuariosPort {
  admins: number[] = [1];
  fechasIngreso = new Map<number, string | null>();
  colaboradores: ColaboradorResumen[] = [];
  existentes = new Set<number>([1, 2]);
  /** userId → jefe inmediato (sin entrada = sin jefe en el organigrama). */
  jefes = new Map<number, number>();

  findAdminsActivosIds(): Promise<number[]> {
    return Promise.resolve([...this.admins]);
  }
  findFechaIngresoReferencia(userId: number): Promise<string | null> {
    return Promise.resolve(this.fechasIngreso.get(userId) ?? null);
  }
  findColaboradores(): Promise<ColaboradorResumen[]> {
    return Promise.resolve([...this.colaboradores]);
  }
  exists(userId: number): Promise<boolean> {
    return Promise.resolve(this.existentes.has(userId));
  }
  esJefe(userId: number): Promise<boolean> {
    return Promise.resolve([...this.jefes.values()].includes(userId));
  }
  findJefeInmediatoId(userId: number): Promise<number | null> {
    return Promise.resolve(this.jefes.get(userId) ?? null);
  }
}

export class FakeNotificacionesPort extends NotificacionesPort {
  readonly creadas: NuevaNotificacion[] = [];
  crear(notificacion: NuevaNotificacion): Promise<void> {
    this.creadas.push(notificacion);
    return Promise.resolve();
  }
}
