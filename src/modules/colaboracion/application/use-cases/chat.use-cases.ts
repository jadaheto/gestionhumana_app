import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { validarMensajeChat } from '../../domain/mensaje-chat';
import { ChatRepository } from '../../domain/repositories';
import { UsuariosPort } from '../../domain/usuarios.port';
import { ContactoChatDto, MensajeChatDto } from '../dto/colaboracion.dto';

@Injectable()
export class ListContactosChatUseCase implements UseCase<Actor, ContactoChatDto[]> {
  constructor(private readonly chat: ChatRepository) {}
  execute(actor: Actor): Promise<ContactoChatDto[]> {
    return this.chat.contactos(actor.id);
  }
}

/** Devuelve la conversación y marca como leídos los mensajes del contacto (igual que `Chat::get_conversation`). */
@Injectable()
export class GetConversacionUseCase implements UseCase<{ actor: Actor; contactoId: number }, MensajeChatDto[]> {
  constructor(
    private readonly chat: ChatRepository,
    private readonly usuarios: UsuariosPort,
  ) {}
  async execute({ actor, contactoId }: { actor: Actor; contactoId: number }): Promise<MensajeChatDto[]> {
    await validarContacto(actor, contactoId, this.usuarios);
    await this.chat.marcarLeidos(contactoId, actor.id);
    return this.chat.conversacion(actor.id, contactoId);
  }
}

@Injectable()
export class EnviarMensajeChatUseCase implements UseCase<
  { actor: Actor; receptorId: number; mensaje: string },
  MensajeChatDto
> {
  constructor(
    private readonly chat: ChatRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
  ) {}
  async execute({
    actor,
    receptorId,
    mensaje,
  }: {
    actor: Actor;
    receptorId: number;
    mensaje: string;
  }): Promise<MensajeChatDto> {
    await validarContacto(actor, receptorId, this.usuarios, 'Destinatario inválido.');
    const texto = validarMensajeChat(mensaje);
    return this.chat.guardar(actor.id, receptorId, texto, this.clock.now().toISOString());
  }
}

@Injectable()
export class MarcarConversacionLeidaUseCase implements UseCase<{ actor: Actor; contactoId: number }, void> {
  constructor(private readonly chat: ChatRepository) {}
  execute({ actor, contactoId }: { actor: Actor; contactoId: number }): Promise<void> {
    return this.chat.marcarLeidos(contactoId, actor.id);
  }
}

async function validarContacto(
  actor: Actor,
  contactoId: number,
  usuarios: UsuariosPort,
  mensaje = 'Contacto inválido.',
): Promise<void> {
  if (!contactoId || contactoId === actor.id || !(await usuarios.existe(contactoId)))
    throw new ValidationError(mensaje);
}
