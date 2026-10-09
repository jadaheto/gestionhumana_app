import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { Mailer } from '../../../../shared/application/ports/mailer.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AsistenciaResumenRepository } from '../../domain/ports';
import { MemorandosResultadoDto } from '../dto/asistencia.dto';
import { ConsolidarResumenDiarioUseCase } from './consolidar-resumen-diario.use-case';

export interface EnviarMemorandosInput {
  sedeId: number;
  fecha?: string;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function fechaLegible(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Envía por correo los memorandos de tardanza pendientes de una sede y fecha
 * (`Asistencia::enviar_memorandos`). Reconsolida antes de enviar, respeta el
 * interruptor `enviarMemorandoTardanza` de la política y registra el resultado
 * (`memo_enviado` / `memo_error`) por cada fila.
 */
@Injectable()
export class EnviarMemorandosUseCase implements UseCase<EnviarMemorandosInput, MemorandosResultadoDto> {
  constructor(
    private readonly consolidar: ConsolidarResumenDiarioUseCase,
    private readonly resumenes: AsistenciaResumenRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
  ) {}

  async execute(input: EnviarMemorandosInput): Promise<MemorandosResultadoDto> {
    if (!Number.isInteger(input.sedeId) || input.sedeId <= 0) throw new ValidationError('Debes seleccionar una sede.');
    const fecha = input.fecha?.trim() || this.clock.today();

    const politica = await this.consolidar.execute({ fecha, sedeId: input.sedeId });
    if (!politica.enviarMemorandoTardanza) {
      return {
        enviados: 0,
        fallidos: 0,
        mensaje: 'El envío de memorandos está desactivado en la política de la sede.',
      };
    }

    const pendientes = await this.resumenes.findTardePendientesMemo(fecha, input.sedeId);
    if (pendientes.length === 0) {
      return { enviados: 0, fallidos: 0, mensaje: 'No hay memorandos pendientes de envío para esa fecha.' };
    }

    let enviados = 0;
    let fallidos = 0;
    for (const r of pendientes) {
      const nombre = escapeHtml(`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim());
      try {
        await this.mailer.send({
          to: r.email as string,
          subject: `Memorando - Llegada tarde (${fechaLegible(fecha)})`,
          html:
            `<p>Hola <strong>${nombre}</strong>,</p>` +
            `<p>Se registra una <strong>llegada tarde</strong> el día ${fechaLegible(fecha)}.</p>` +
            `<p>Minutos de tardanza: <strong>${r.minutosTarde}</strong>.</p>` +
            '<p>Este mensaje se genera de acuerdo con la política de asistencia vigente.</p>' +
            '<br><p>Gestión Humana - Comfasucre</p>',
        });
        enviados++;
        await this.resumenes.markMemo(r.id as number, true, null, this.clock.now());
      } catch (e) {
        fallidos++;
        const msg = e instanceof Error && e.message ? e.message : 'No se pudo enviar correo';
        await this.resumenes.markMemo(r.id as number, false, msg.slice(0, 255), this.clock.now());
      }
    }

    return {
      enviados,
      fallidos,
      mensaje: enviados > 0 ? `Memorandos de tardanza enviados: ${enviados}.` : 'No se pudo enviar ningún memorando.',
    };
  }
}
