import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaRegistroRepository, AsistenciaResumenRepository } from '../../domain/ports';
import { HistorialAsistenciaDto } from '../dto/asistencia.dto';
import { validarFecha } from './consolidar-resumen-diario.use-case';

export interface GetMiHistorialInput {
  actor: Actor;
  /** `YYYY-MM-DD`; por defecto el primer día del mes actual. */
  desde?: string;
  /** `YYYY-MM-DD`; por defecto el último día del mes actual. */
  hasta?: string;
}

/**
 * Historial de asistencia del propio funcionario (`Asistencia::historial`).
 * Une los registros manuales/externos de la tabla `asistencia` con el resumen
 * diario consolidado del reloj biométrico. Siempre usa `actor.id`.
 */
@Injectable()
export class GetMiHistorialUseCase implements UseCase<GetMiHistorialInput, HistorialAsistenciaDto[]> {
  constructor(
    private readonly registros: AsistenciaRegistroRepository,
    private readonly resumenes: AsistenciaResumenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetMiHistorialInput): Promise<HistorialAsistenciaDto[]> {
    const hoy = this.clock.today();
    const desde = validarFecha(input.desde?.trim() || `${hoy.slice(0, 7)}-01`, 'fecha inicial');
    const hasta = validarFecha(input.hasta?.trim() || ultimoDiaDelMes(hoy), 'fecha final');
    if (desde > hasta) throw new ValidationError('La fecha inicial no puede ser posterior a la final.');

    const userId = input.actor.id;
    const [manuales, consolidados] = await Promise.all([
      this.registros.findByUsuarioYRango(userId, desde, hasta),
      this.resumenes.findByUsuarioYRango(userId, desde, hasta),
    ]);

    const filas: HistorialAsistenciaDto[] = [
      ...manuales.map((r) => ({
        fecha: r.fecha,
        horaEntrada: r.horaEntrada,
        horaSalida: r.horaSalida,
        tipo: r.tipo || 'presencial',
        estado: null,
        observacion: r.observacion ?? '',
      })),
      ...consolidados.map((r) => ({
        fecha: r.fecha,
        horaEntrada: r.horaEntrada,
        horaSalida: r.horaSalida,
        tipo: 'biometrico',
        estado: r.estado,
        observacion: r.detalle ?? r.justificacion ?? '',
      })),
    ];
    return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
  }
}

function ultimoDiaDelMes(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  return `${fecha.slice(0, 7)}-${String(dias).padStart(2, '0')}`;
}
