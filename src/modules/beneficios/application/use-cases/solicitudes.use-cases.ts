import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, InvalidOperationError, NotFoundError } from '../../../../shared/domain/domain-error';
import { DiasHabilesCalculator } from '../../domain/dias-habiles.calculator';
import { Permiso } from '../../domain/permiso';
import { NotificacionesPort, UsuariosPort } from '../../domain/ports';
import { PermisoRepository, VacacionesSuspensionRepository } from '../../domain/repositories';
import { VacacionesSaldoCalculator } from '../../domain/vacaciones-saldo';
import { VacacionesSuspension } from '../../domain/vacaciones-suspension';
import {
  CrearSolicitudInput,
  ListarSolicitudesJefeInput,
  PermisoDto,
  ResolverSolicitudInput,
  SuspenderVacacionesInput,
  SuspenderVacacionesResultado,
} from '../dto/beneficios.dto';
import { toTimestamp } from '../fecha-hora';
import { tipoLegible, toPermisoDto } from '../mappers';

/** Carpeta y restricciones del soporte de solicitudes (mismas que el legado). */
export const SOPORTES_FOLDER = 'soportes';
export const SOPORTES_EXTENSIONES = ['gif', 'jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
export const SOPORTES_MAX_BYTES = 5 * 1024 * 1024;

/** Ruta del frontend a la que enlaza la notificación de nueva solicitud. */
export const LINK_ADMIN_SOLICITUDES = '/solicitudes/admin';
/** Ruta del frontend donde el jefe inmediato responde las solicitudes de su equipo. */
export const LINK_JEFE_SOLICITUDES = '/solicitudes/equipo';

/**
 * Crear una solicitud (permiso, vacaciones o incapacidad) para el propio actor.
 * Guarda el soporte en `uploads/soportes`. La solicitud pasa primero por el jefe inmediato
 * (según el organigrama) y luego por Gestión Humana; si el colaborador no tiene jefe, va
 * directo a Gestión Humana (administradores activos).
 */
@Injectable()
export class CrearSolicitudUseCase implements UseCase<CrearSolicitudInput, PermisoDto> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly usuarios: UsuariosPort,
    private readonly notificaciones: NotificacionesPort,
    private readonly files: FileStorage,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: CrearSolicitudInput): Promise<PermisoDto> {
    let archivoSoporte: string | null = null;
    if (input.archivo) {
      const stored = await this.files.save(input.archivo.buffer, {
        folder: SOPORTES_FOLDER,
        originalName: input.archivo.originalName,
        mimeType: input.archivo.mimeType,
        allowedExtensions: SOPORTES_EXTENSIONES,
        maxBytes: SOPORTES_MAX_BYTES,
      });
      archivoSoporte = stored.relativePath;
    }

    const permiso = Permiso.create({
      userId: input.actor.id,
      tipoPermiso: input.tipoPermiso,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      horas: input.horas ?? null,
      justificacion: input.justificacion,
      archivoSoporte,
      fechaSolicitud: this.clock.today(),
      jefeId: await this.usuarios.findJefeInmediatoId(input.actor.id),
    });
    const saved = await this.permisos.save(permiso);
    if (saved.props.jefeId) {
      await this.notificaciones.crear({
        userId: saved.props.jefeId,
        titulo: 'Solicitud de tu equipo',
        mensaje: `${actorFullName(input.actor)} registró una solicitud de ${tipoLegible(saved.tipoPermiso)} que requiere tu visto bueno`,
        tipo: 'solicitud',
        link: LINK_JEFE_SOLICITUDES,
      });
    } else {
      await this.notificarAdmins(input.actor, saved.tipoPermiso);
    }
    return toPermisoDto(saved, this.calculadora);
  }

  private async notificarAdmins(actor: Actor, tipo: string): Promise<void> {
    const admins = await this.usuarios.findAdminsActivosIds();
    const nombre = actorFullName(actor);
    for (const adminId of admins) {
      await this.notificaciones.crear({
        userId: adminId,
        titulo: 'Nueva solicitud',
        mensaje: `${nombre} registró una solicitud de ${tipoLegible(tipo)}`,
        tipo: 'solicitud',
        link: LINK_ADMIN_SOLICITUDES,
      });
    }
  }
}

/** Solicitudes del propio actor, más recientes primero. */
@Injectable()
export class ListarMisSolicitudesUseCase implements UseCase<Actor, PermisoDto[]> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(actor: Actor): Promise<PermisoDto[]> {
    const rows = await this.permisos.findByUser(actor.id);
    return rows.map((p) => toPermisoDto(p, this.calculadora));
  }
}

/** Todas las solicitudes con nombres (administración), filtrables por estado. */
@Injectable()
export class ListarSolicitudesAdminUseCase implements UseCase<{ estado?: string | null }, PermisoDto[]> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: { estado?: string | null }): Promise<PermisoDto[]> {
    const rows = await this.permisos.findAll({ estado: input.estado || null });
    return rows.map((r) =>
      toPermisoDto(r.permiso, this.calculadora, { colaborador: r.colaborador, aprobador: r.aprobador, jefe: r.jefe }),
    );
  }
}

/** Solicitudes en las que el actor es el jefe inmediato, filtrables por el estado de su visto bueno. */
@Injectable()
export class ListarSolicitudesJefeUseCase implements UseCase<ListarSolicitudesJefeInput, PermisoDto[]> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: ListarSolicitudesJefeInput): Promise<PermisoDto[]> {
    const rows = await this.permisos.findAll({ jefeId: input.actor.id, jefeEstado: input.estado || null });
    return rows.map((r) =>
      toPermisoDto(r.permiso, this.calculadora, { colaborador: r.colaborador, aprobador: r.aprobador, jefe: r.jefe }),
    );
  }
}

/** Indica si el actor es jefe (responsable de un área o con solicitudes a su cargo): decide si ve la bandeja del equipo. */
@Injectable()
export class EsJefeUseCase implements UseCase<Actor, { esJefe: boolean }> {
  constructor(private readonly usuarios: UsuariosPort) {}
  async execute(actor: Actor): Promise<{ esJefe: boolean }> {
    return { esJefe: await this.usuarios.esJefe(actor.id) };
  }
}

/**
 * Respuesta del jefe inmediato (primer paso). Si da el visto bueno, la solicitud pasa a
 * Gestión Humana y se notifica a los administradores; si la rechaza, queda cerrada.
 * Un administrador puede dar el visto bueno en nombre del jefe (p. ej. si está ausente),
 * dejando el motivo; el jefe queda notificado.
 */
@Injectable()
export class ResolverSolicitudComoJefeUseCase implements UseCase<
  ResolverSolicitudInput & { aprobar: boolean },
  PermisoDto
> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly usuarios: UsuariosPort,
    private readonly notificaciones: NotificacionesPort,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: ResolverSolicitudInput & { aprobar: boolean }): Promise<PermisoDto> {
    const permiso = await this.permisos.findById(input.permisoId);
    if (!permiso) throw new NotFoundError('Solicitud', input.permisoId);
    const esElJefe = permiso.props.jefeId === input.actor.id;
    const enNombre = !esElJefe && isAdmin(input.actor) && input.aprobar;
    if (!esElJefe && !enNombre) {
      throw new ForbiddenError('Sólo el jefe inmediato del colaborador puede responder esta solicitud.');
    }
    const ahora = toTimestamp(this.clock.now());
    const observacion = input.observacion ?? null;
    const tipo = tipoLegible(permiso.tipoPermiso);

    if (enNombre) {
      const saved = await this.permisos.save(permiso.aprobarEnNombreDelJefe(input.actor.id, observacion, ahora));
      const admin = actorFullName(input.actor);
      if (saved.props.jefeId) {
        await this.notificaciones.crear({
          userId: saved.props.jefeId,
          titulo: 'Solicitud aprobada en tu nombre',
          mensaje: `${admin} (Gestión Humana) dio el visto bueno en tu nombre a una solicitud de ${tipo} de tu equipo`,
          tipo: 'solicitud',
          link: LINK_JEFE_SOLICITUDES,
        });
      }
      await this.notificaciones.crear({
        userId: saved.userId,
        titulo: 'Tu solicitud avanzó',
        mensaje: `Gestión Humana dio el visto bueno en nombre de tu jefe a tu solicitud de ${tipo}; falta la aprobación final`,
        tipo: 'solicitud',
        link: '/solicitudes',
      });
      return toPermisoDto(saved, this.calculadora);
    }

    const resuelto = input.aprobar
      ? permiso.aprobarComoJefe(observacion, ahora)
      : permiso.rechazarComoJefe(observacion, ahora);
    const saved = await this.permisos.save(resuelto);

    const jefe = actorFullName(input.actor);
    if (input.aprobar) {
      for (const adminId of await this.usuarios.findAdminsActivosIds()) {
        await this.notificaciones.crear({
          userId: adminId,
          titulo: 'Solicitud con visto bueno del jefe',
          mensaje: `${jefe} dio el visto bueno a una solicitud de ${tipo}; falta la aprobación de Gestión Humana`,
          tipo: 'solicitud',
          link: LINK_ADMIN_SOLICITUDES,
        });
      }
    }
    await this.notificaciones.crear({
      userId: saved.userId,
      titulo: input.aprobar ? 'Tu jefe aprobó tu solicitud' : 'Tu jefe rechazó tu solicitud',
      mensaje: input.aprobar
        ? `${jefe} dio el visto bueno a tu solicitud de ${tipo}; ahora la revisa Gestión Humana`
        : `${jefe} rechazó tu solicitud de ${tipo}`,
      tipo: 'solicitud',
      link: '/solicitudes',
    });
    return toPermisoDto(saved, this.calculadora);
  }
}

/**
 * Aprobar una solicitud pendiente. Si es de vacaciones, verifica que tenga
 * días hábiles y que no supere el saldo disponible (sin vacaciones anticipadas).
 */
@Injectable()
export class AprobarSolicitudUseCase implements UseCase<ResolverSolicitudInput, PermisoDto> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly suspensiones: VacacionesSuspensionRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
    private readonly saldoCalculator: VacacionesSaldoCalculator,
  ) {}

  async execute(input: ResolverSolicitudInput): Promise<PermisoDto> {
    const permiso = await this.permisos.findById(input.permisoId);
    if (!permiso) throw new NotFoundError('Solicitud', input.permisoId);
    if (!permiso.estaPendiente) throw new InvalidOperationError('La solicitud ya fue procesada.');
    if (permiso.esperaJefe) {
      throw new InvalidOperationError('La solicitud aún espera el visto bueno del jefe inmediato.');
    }

    if (permiso.esVacaciones) {
      const diasSolicitados = this.calculadora.calcularDiasHabiles(permiso.props.fechaInicio, permiso.props.fechaFin);
      if (diasSolicitados <= 0) {
        throw new InvalidOperationError('La solicitud de vacaciones no tiene días hábiles válidos.');
      }
      const disponibles = await this.diasDisponibles(permiso.userId, permiso.id);
      if (diasSolicitados > disponibles) {
        throw new InvalidOperationError(
          `No se puede aprobar vacaciones anticipadas. Solicitados: ${diasSolicitados} días hábiles, disponibles: ${disponibles}.`,
        );
      }
    }

    const aprobado = permiso.aprobar(input.actor.id, input.observacion ?? null, toTimestamp(this.clock.now()));
    return toPermisoDto(await this.permisos.save(aprobado), this.calculadora);
  }

  private async diasDisponibles(userId: number, excluirPermisoId: number | null): Promise<number> {
    const [fechaReferencia, aprobadas] = await Promise.all([
      this.usuarios.findFechaIngresoReferencia(userId),
      this.permisos.findVacacionesAprobadas(userId, excluirPermisoId),
    ]);
    const ids = aprobadas.map((p) => p.id).filter((id): id is number => id !== null);
    const disfrutados = ids.length ? await this.suspensiones.findDiasDisfrutados(ids) : new Map<number, number>();
    const saldo = this.saldoCalculator.calcularSaldo({
      fechaReferencia,
      hoy: this.clock.today(),
      vacacionesAprobadas: aprobadas,
      diasDisfrutadosPorPermiso: disfrutados,
    });
    return saldo.diasPendientes;
  }
}

/** Rechazar una solicitud pendiente. */
@Injectable()
export class RechazarSolicitudUseCase implements UseCase<ResolverSolicitudInput, PermisoDto> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: ResolverSolicitudInput): Promise<PermisoDto> {
    const permiso = await this.permisos.findById(input.permisoId);
    if (!permiso) throw new NotFoundError('Solicitud', input.permisoId);
    const rechazado = permiso.rechazar(input.actor.id, input.observacion ?? null, toTimestamp(this.clock.now()));
    return toPermisoDto(await this.permisos.save(rechazado), this.calculadora);
  }
}

/** Suspender unas vacaciones aprobadas, reintegrando los días no disfrutados. */
@Injectable()
export class SuspenderVacacionesUseCase implements UseCase<SuspenderVacacionesInput, SuspenderVacacionesResultado> {
  constructor(
    private readonly permisos: PermisoRepository,
    private readonly suspensiones: VacacionesSuspensionRepository,
    private readonly clock: Clock,
    private readonly calculadora: DiasHabilesCalculator,
  ) {}

  async execute(input: SuspenderVacacionesInput): Promise<SuspenderVacacionesResultado> {
    const permiso = await this.permisos.findById(input.permisoId);
    if (!permiso) throw new InvalidOperationError('Solo se pueden suspender vacaciones aprobadas.');
    const existente = await this.suspensiones.findByPermiso(input.permisoId);
    const suspension = VacacionesSuspension.registrar({
      permiso,
      diasDisfrutados: input.diasDisfrutados,
      motivo: input.motivo ?? null,
      adminId: input.actor.id,
      ahora: toTimestamp(this.clock.now()),
      calculadora: this.calculadora,
      existente,
    });
    const saved = await this.suspensiones.save(suspension);
    const s = saved.props;
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
      fechaInicio: permiso.props.fechaInicio,
      fechaFin: permiso.props.fechaFin,
      message: `Vacaciones suspendidas. Disfrutados: ${s.diasDisfrutados} día(s). Reintegrados: ${s.diasReintegrados} día(s).`,
    };
  }
}
