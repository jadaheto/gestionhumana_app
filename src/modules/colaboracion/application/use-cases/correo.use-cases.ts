import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { Mailer } from '../../../../shared/application/ports/mailer.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName } from '../../../../shared/domain/actor';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { CarpetaCorreo } from '../../domain/correo-interno';
import { CorreoRepository } from '../../domain/repositories';
import { UsuariosPort } from '../../domain/usuarios.port';
import { CorreoDto, RedactarCorreoInput, RedactarCorreoResultado } from '../dto/colaboracion.dto';

@Injectable()
export class ListBuzonUseCase implements UseCase<{ actor: Actor; carpeta?: string }, CorreoDto[]> {
  constructor(private readonly correos: CorreoRepository) {}
  execute({ actor, carpeta }: { actor: Actor; carpeta?: string }): Promise<CorreoDto[]> {
    const c: CarpetaCorreo = carpeta === 'sent' ? 'sent' : 'inbox';
    return this.correos.buzon(actor.id, c);
  }
}

/** Devuelve un correo propio y lo marca como leído si el actor es el receptor. */
@Injectable()
export class GetCorreoUseCase implements UseCase<{ actor: Actor; id: number }, CorreoDto> {
  constructor(private readonly correos: CorreoRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<CorreoDto> {
    await this.correos.marcarLeido(id, actor.id);
    const correo = await this.correos.findById(id, actor.id);
    if (!correo) throw new NotFoundError('Correo', id);
    return correo;
  }
}

@Injectable()
export class ContarCorreosNoLeidosUseCase implements UseCase<Actor, number> {
  constructor(private readonly correos: CorreoRepository) {}
  execute(actor: Actor): Promise<number> {
    return this.correos.contarNoLeidos(actor.id);
  }
}

/**
 * Envía un correo interno: copia en la bandeja del destinatario y en enviados
 * del remitente; además intenta la notificación externa por SMTP (si falla,
 * el correo interno igualmente queda entregado, como en `Email::send_email`).
 */
@Injectable()
export class RedactarCorreoUseCase implements UseCase<
  { actor: Actor; input: RedactarCorreoInput },
  RedactarCorreoResultado
> {
  private readonly logger = new Logger(RedactarCorreoUseCase.name);
  constructor(
    private readonly correos: CorreoRepository,
    private readonly usuarios: UsuariosPort,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, input }: { actor: Actor; input: RedactarCorreoInput }): Promise<RedactarCorreoResultado> {
    const paraEmail = (input.paraEmail ?? '').trim().toLowerCase();
    const asunto = (input.asunto ?? '').trim();
    const cuerpo = (input.cuerpo ?? '').trim();
    if (!paraEmail || !asunto || !cuerpo) throw new ValidationError('Completa todos los campos.');
    const destinatario = await this.usuarios.buscarPorEmail(paraEmail);
    if (!destinatario) throw new ValidationError('Solo puedes enviar correos a usuarios registrados en el sistema.');

    const now = this.clock.now().toISOString();
    await this.correos.guardar({
      emisorId: actor.id,
      receptorId: destinatario.id,
      asunto,
      cuerpo,
      carpeta: 'inbox',
      leido: false,
      createdAt: now,
    });
    const id = await this.correos.guardar({
      emisorId: actor.id,
      receptorId: destinatario.id,
      asunto,
      cuerpo,
      carpeta: 'sent',
      leido: true,
      createdAt: now,
    });

    let notificacionExternaEnviada = true;
    try {
      await this.mailer.send({
        to: destinatario.email,
        subject: asunto,
        html: `<p>${escapeHtml(cuerpo).replace(/\n/g, '<br>')}</p><p><small>Enviado por ${escapeHtml(actorFullName(actor))} desde Gestión Humana.</small></p>`,
      });
    } catch (e) {
      notificacionExternaEnviada = false;
      this.logger.warn(`No se pudo enviar la notificación SMTP del correo interno: ${(e as Error).message}`);
    }
    return { id, notificacionExternaEnviada };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
