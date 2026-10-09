import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { EventoCalendario } from '../../domain/evento-calendario';
import { EventoCalendarioRepository } from '../../domain/repositories';
import { EventosSistemaPort } from '../../domain/usuarios.port';
import { EventoCalendarioDto, GuardarEventoInput } from '../dto/colaboracion.dto';

export function toEventoDto(e: EventoCalendario): EventoCalendarioDto {
  const p = e.props;
  return {
    id: p.id ?? 0,
    titulo: p.titulo,
    inicio: p.inicio,
    fin: p.fin,
    todoElDia: p.todoElDia,
    clase: p.clase,
    ubicacion: p.ubicacion,
    descripcion: p.descripcion,
    esDeSistema: false,
  };
}

const RANGO = /^\d{4}-\d{2}-\d{2}$/;

/** Años completos entre una fecha y otra (para "Aniversario (N años)"). */
function aniosEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  let anios = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) anios--;
  return Math.max(0, anios);
}

/**
 * Lista los eventos propios del usuario en un rango (opcional) más los eventos
 * de sistema (cumpleaños y aniversarios del año consultado), como hacía
 * `Calendar::get_events`.
 */
@Injectable()
export class ListEventosUseCase implements UseCase<
  { actor: Actor; desde?: string; hasta?: string; incluirSistema?: boolean },
  EventoCalendarioDto[]
> {
  constructor(
    private readonly eventos: EventoCalendarioRepository,
    private readonly sistema: EventosSistemaPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    actor: Actor;
    desde?: string;
    hasta?: string;
    incluirSistema?: boolean;
  }): Promise<EventoCalendarioDto[]> {
    if ((input.desde && !RANGO.test(input.desde)) || (input.hasta && !RANGO.test(input.hasta))) {
      throw new ValidationError('El rango de fechas debe tener el formato YYYY-MM-DD.');
    }
    const propios = (await this.eventos.findByUsuario(input.actor.id, input.desde, input.hasta)).map(toEventoDto);
    if (input.incluirSistema === false) return propios;

    const hoy = this.clock.today();
    const anios = new Set<number>([Number((input.desde ?? hoy).slice(0, 4)), Number((input.hasta ?? hoy).slice(0, 4))]);
    const especiales: EventoCalendarioDto[] = [];
    for (const ev of await this.sistema.listar()) {
      for (const anio of anios) {
        const fecha = fechaEnAnio(ev.fechaOrigen, anio);
        if (!fecha) continue;
        if (input.desde && fecha < input.desde) continue;
        if (input.hasta && fecha > input.hasta) continue;
        if (ev.tipo === 'cumpleanos') {
          especiales.push({
            id: `sys-bday-${ev.userId}-${anio}`,
            titulo: `Cumpleaños: ${ev.nombre}`,
            inicio: `${fecha}T00:00:00`,
            fin: null,
            todoElDia: true,
            clase: 'bg-info-subtle',
            ubicacion: ev.areaNombre,
            descripcion: 'Cumpleaños corporativo',
            esDeSistema: true,
            tipoSistema: 'cumpleanos',
          });
        } else {
          const n = aniosEntre(ev.fechaOrigen, fecha);
          if (n < 1) continue;
          especiales.push({
            id: `sys-ann-${ev.userId}-${anio}`,
            titulo: `Aniversario (${n} ${n === 1 ? 'año' : 'años'}): ${ev.nombre}`,
            inicio: `${fecha}T00:00:00`,
            fin: null,
            todoElDia: true,
            clase: 'bg-success-subtle',
            ubicacion: ev.areaNombre,
            descripcion: 'Aniversario laboral',
            esDeSistema: true,
            tipoSistema: 'aniversario',
          });
        }
      }
    }
    return [...propios, ...especiales];
  }
}

/** Proyecta una fecha `YYYY-MM-DD` al año indicado (29/02 → 28/02 en años no bisiestos). */
export function fechaEnAnio(fecha: string, anio: number): string | null {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return null;
  let dia = Number(m[2]);
  const mes = Number(m[1]);
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  if (mes === 2 && dia === 29 && !bisiesto) dia = 28;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

@Injectable()
export class GuardarEventoUseCase implements UseCase<{ actor: Actor; input: GuardarEventoInput }, EventoCalendarioDto> {
  constructor(private readonly eventos: EventoCalendarioRepository) {}
  async execute({ actor, input }: { actor: Actor; input: GuardarEventoInput }): Promise<EventoCalendarioDto> {
    if (input.id) {
      const existente = await this.eventos.findById(input.id);
      // Los eventos son privados: si no es del actor se responde como inexistente.
      if (!existente || existente.props.userId !== actor.id) throw new NotFoundError('Evento', input.id);
    }
    const evento = EventoCalendario.create({
      id: input.id ?? null,
      userId: actor.id,
      titulo: input.titulo,
      inicio: input.inicio,
      fin: input.fin ?? null,
      todoElDia: input.todoElDia ?? false,
      clase: input.clase ?? null,
      ubicacion: input.ubicacion ?? null,
      descripcion: input.descripcion ?? null,
    });
    return toEventoDto(await this.eventos.save(evento));
  }
}

@Injectable()
export class EliminarEventoUseCase implements UseCase<{ actor: Actor; id: number }, void> {
  constructor(private readonly eventos: EventoCalendarioRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<void> {
    const existente = await this.eventos.findById(id);
    if (!existente || existente.props.userId !== actor.id) throw new NotFoundError('Evento', id);
    await this.eventos.delete(id);
  }
}
