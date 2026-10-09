import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaPolitica } from '../../domain/asistencia-politica';
import { consolidarDia } from '../../domain/consolidar-resumen.service';
import { Marcacion } from '../../domain/marcacion';
import {
  AsistenciaMarcacionRepository,
  AsistenciaPoliticaRepository,
  AsistenciaResumenRepository,
  ColaboradoresSedeReader,
  JustificacionReader,
} from '../../domain/ports';

export interface ConsolidarResumenInput {
  fecha: string;
  sedeId: number;
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validarFecha(fecha: string, campo = 'fecha'): string {
  if (!FECHA_REGEX.test(fecha ?? '') || Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
    throw new ValidationError(`La ${campo} debe tener formato YYYY-MM-DD.`);
  }
  return fecha;
}

/**
 * Reconstruye el resumen diario de una sede para una fecha (equivale a
 * `Asistencia_model::rebuild_daily_summary`): para cada colaborador activo de
 * la sede consolida sus marcaciones con la política vigente y guarda el resultado.
 */
@Injectable()
export class ConsolidarResumenDiarioUseCase implements UseCase<ConsolidarResumenInput, AsistenciaPolitica> {
  constructor(
    private readonly politicas: AsistenciaPoliticaRepository,
    private readonly marcaciones: AsistenciaMarcacionRepository,
    private readonly resumenes: AsistenciaResumenRepository,
    private readonly colaboradores: ColaboradoresSedeReader,
    private readonly justificaciones: JustificacionReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: ConsolidarResumenInput): Promise<AsistenciaPolitica> {
    const fecha = validarFecha(input.fecha);
    if (!Number.isInteger(input.sedeId) || input.sedeId <= 0) throw new ValidationError('Debes seleccionar una sede.');

    const politica = (await this.politicas.findBySede(input.sedeId)) ?? AsistenciaPolitica.porDefecto(input.sedeId);
    const usuarios = await this.colaboradores.findActivosBySede(input.sedeId);
    const marcas = await this.marcaciones.findBySedeYFecha(input.sedeId, fecha);

    const porUsuario = new Map<number, Marcacion[]>();
    for (const m of marcas) {
      const lista = porUsuario.get(m.userId) ?? [];
      lista.push(m);
      porUsuario.set(m.userId, lista);
    }

    const ahora = this.clock.now();
    for (const u of usuarios) {
      const justificacion = await this.justificaciones.justificacionDia(u.id, fecha);
      const r = consolidarDia({ politica, justificacion, marcaciones: porUsuario.get(u.id) ?? [] });
      await this.resumenes.upsert({
        userId: u.id,
        sedeId: input.sedeId,
        fecha,
        horaEntrada: r.horaEntrada,
        horaSalida: r.horaSalida,
        minutosTarde: r.minutosTarde,
        minutosSalidaTemprana: r.minutosSalidaTemprana,
        estado: r.estado,
        justificacion: r.justificacion || null,
        detalle: r.detalle || null,
        updatedAt: ahora,
      });
    }
    return politica;
  }
}
