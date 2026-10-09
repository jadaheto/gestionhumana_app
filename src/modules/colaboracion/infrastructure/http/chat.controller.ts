import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { ContactoChatDto, MensajeChatDto } from '../../application/dto/colaboracion.dto';
import {
  EnviarMensajeChatUseCase,
  GetConversacionUseCase,
  ListContactosChatUseCase,
  MarcarConversacionLeidaUseCase,
} from '../../application/use-cases/chat.use-cases';
import { EnviarMensajeRequestDto } from './dto/colaboracion-request.dto';

/** Chat interno entre usuarios (sustituye a `Chat.php`). El frontend hace polling cada 5 s. */
@ApiTags('Colaboración · Chat')
@ApiBearerAuth()
@Controller('colaboracion/chat')
export class ChatController {
  constructor(
    private readonly listContactos: ListContactosChatUseCase,
    private readonly getConversacion: GetConversacionUseCase,
    private readonly enviarMensaje: EnviarMensajeChatUseCase,
    private readonly marcarLeida: MarcarConversacionLeidaUseCase,
  ) {}

  @Get('contactos')
  @ApiOperation({ summary: 'Contactos con último mensaje y no leídos' })
  contactos(@CurrentUser() actor: Actor): Promise<ContactoChatDto[]> {
    return this.listContactos.execute(actor);
  }

  @Get('conversacion/:contactoId')
  @ApiOperation({ summary: 'Conversación con un contacto (marca como leídos sus mensajes)' })
  conversacion(
    @CurrentUser() actor: Actor,
    @Param('contactoId', ParseIntPipe) contactoId: number,
  ): Promise<MensajeChatDto[]> {
    return this.getConversacion.execute({ actor, contactoId });
  }

  @Post('conversacion/:contactoId/leer')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar como leídos los mensajes de un contacto' })
  leer(@CurrentUser() actor: Actor, @Param('contactoId', ParseIntPipe) contactoId: number): Promise<void> {
    return this.marcarLeida.execute({ actor, contactoId });
  }

  @Post('mensajes')
  @ApiOperation({ summary: 'Enviar mensaje' })
  enviar(@CurrentUser() actor: Actor, @Body() dto: EnviarMensajeRequestDto): Promise<MensajeChatDto> {
    return this.enviarMensaje.execute({ actor, receptorId: dto.receptorId, mensaje: dto.mensaje });
  }
}
