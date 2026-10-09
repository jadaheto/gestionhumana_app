import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { Notificacion } from '../../domain/notificacion';
import { NotificacionRepository } from '../../domain/notificacion.repository';
import { ContadorNoLeidasDto, ListaNotificacionesDto, NotificacionDto } from '../dto/notificaciones.dto';

export const LIMITE_POR_DEFECTO = 20;
export const LIMITE_MAXIMO = 100;

export function toNotificacionDto(n: Notificacion): NotificacionDto {
  return {
    id: n.props.id ?? 0,
    titulo: n.props.titulo,
    mensaje: n.props.mensaje,
    tipo: n.props.tipo,
    leida: n.props.leida,
    link: n.props.link,
    createdAt: n.props.createdAt.toISOString(),
  };
}

export interface ListNotificacionesInput {
  actor: Actor;
  limit?: number;
  soloNoLeidas?: boolean;
}

/** Últimas notificaciones propias con el contador de no leídas (equivale a `notificaciones/lista`). */
@Injectable()
export class ListNotificacionesUseCase implements UseCase<ListNotificacionesInput, ListaNotificacionesDto> {
  constructor(private readonly notificaciones: NotificacionRepository) {}
  async execute(input: ListNotificacionesInput): Promise<ListaNotificacionesDto> {
    const limit = Math.min(Math.max(input.limit ?? LIMITE_POR_DEFECTO, 1), LIMITE_MAXIMO);
    const [items, noLeidas] = await Promise.all([
      this.notificaciones.findRecientes(input.actor.id, limit, input.soloNoLeidas ?? false),
      this.notificaciones.countNoLeidas(input.actor.id),
    ]);
    return { noLeidas, items: items.map(toNotificacionDto) };
  }
}

/** Sólo el contador (para el sondeo periódico de la campana). */
@Injectable()
export class CountNoLeidasUseCase implements UseCase<Actor, ContadorNoLeidasDto> {
  constructor(private readonly notificaciones: NotificacionRepository) {}
  async execute(actor: Actor): Promise<ContadorNoLeidasDto> {
    return { noLeidas: await this.notificaciones.countNoLeidas(actor.id) };
  }
}

/** Marca una notificación propia como leída. Ajena o inexistente → 404. */
@Injectable()
export class MarcarLeidaUseCase implements UseCase<{ actor: Actor; id: number }, void> {
  constructor(private readonly notificaciones: NotificacionRepository) {}
  async execute(input: { actor: Actor; id: number }): Promise<void> {
    const ok = await this.notificaciones.marcarLeida(input.id, input.actor.id);
    if (!ok) throw new NotFoundError('Notificación', input.id);
  }
}

/** Marca todas las notificaciones propias como leídas; devuelve cuántas cambiaron. */
@Injectable()
export class MarcarTodasLeidasUseCase implements UseCase<Actor, { marcadas: number }> {
  constructor(private readonly notificaciones: NotificacionRepository) {}
  async execute(actor: Actor): Promise<{ marcadas: number }> {
    return { marcadas: await this.notificaciones.marcarTodasLeidas(actor.id) };
  }
}

/** Elimina una notificación propia. Ajena o inexistente → 404. */
@Injectable()
export class EliminarNotificacionUseCase implements UseCase<{ actor: Actor; id: number }, void> {
  constructor(private readonly notificaciones: NotificacionRepository) {}
  async execute(input: { actor: Actor; id: number }): Promise<void> {
    const ok = await this.notificaciones.eliminar(input.id, input.actor.id);
    if (!ok) throw new NotFoundError('Notificación', input.id);
  }
}

export interface CrearNotificacionInput {
  userId: number;
  titulo: string;
  mensaje?: string | null;
  tipo?: string | null;
  link?: string | null;
}

/**
 * Crea una notificación para un usuario. Se exporta desde el módulo por si
 * otro contexto prefiere inyectarlo en lugar de insertar directamente en la tabla.
 */
@Injectable()
export class CrearNotificacionUseCase implements UseCase<CrearNotificacionInput, NotificacionDto> {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: CrearNotificacionInput): Promise<NotificacionDto> {
    const n = Notificacion.create({
      userId: input.userId,
      titulo: input.titulo,
      mensaje: input.mensaje,
      tipo: input.tipo,
      link: input.link,
      createdAt: this.clock.now(),
    });
    return toNotificacionDto(await this.notificaciones.save(n));
  }
}
