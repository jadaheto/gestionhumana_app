import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AlternarEstadoApiKeyUseCase,
  CrearApiKeyUseCase,
  EliminarApiKeysUseCase,
  ListApiKeysUseCase,
  RegenerarApiKeyUseCase,
  RenombrarApiKeyUseCase,
} from './application/use-cases/api-keys.use-cases';
import {
  EliminarEventoUseCase,
  GuardarEventoUseCase,
  ListEventosUseCase,
} from './application/use-cases/calendario.use-cases';
import {
  EnviarMensajeChatUseCase,
  GetConversacionUseCase,
  ListContactosChatUseCase,
  MarcarConversacionLeidaUseCase,
} from './application/use-cases/chat.use-cases';
import {
  ContarCorreosNoLeidosUseCase,
  GetCorreoUseCase,
  ListBuzonUseCase,
  RedactarCorreoUseCase,
} from './application/use-cases/correo.use-cases';
import {
  CambiarEstadoTareaUseCase,
  EliminarTareaUseCase,
  GetEstadisticasTareasUseCase,
  GetKanbanUseCase,
  GetTareaUseCase,
  GuardarTareaUseCase,
  ListTareasUseCase,
} from './application/use-cases/tareas.use-cases';
import { ListUsuariosUseCase } from './application/use-cases/usuarios.use-cases';
import { NotificacionesPort } from './domain/notificaciones.port';
import {
  ApiKeyRepository,
  ChatRepository,
  CorreoRepository,
  EventoCalendarioRepository,
  TareaRepository,
} from './domain/repositories';
import { EventosSistemaPort, UsuariosPort } from './domain/usuarios.port';
import { ApiKeysController } from './infrastructure/http/api-keys.controller';
import { CalendarioController } from './infrastructure/http/calendario.controller';
import { ChatController } from './infrastructure/http/chat.controller';
import { CorreoController } from './infrastructure/http/correo.controller';
import { TareasController } from './infrastructure/http/tareas.controller';
import { UsuariosColaboracionController } from './infrastructure/http/usuarios.controller';
import { ApiKeyOrmEntity } from './infrastructure/persistence/api-key.orm-entity';
import { CalendarEventOrmEntity } from './infrastructure/persistence/calendar-event.orm-entity';
import { ChatMessageOrmEntity } from './infrastructure/persistence/chat-message.orm-entity';
import { EmailOrmEntity } from './infrastructure/persistence/email.orm-entity';
import { SqlNotificacionesAdapter } from './infrastructure/persistence/sql-notificaciones.adapter';
import { SqlEventosSistemaAdapter, SqlUsuariosAdapter } from './infrastructure/persistence/sql-usuarios.adapter';
import { TaskAssigneeOrmEntity } from './infrastructure/persistence/task-assignee.orm-entity';
import { TaskOrmEntity } from './infrastructure/persistence/task.orm-entity';
import { TypeOrmApiKeyRepository } from './infrastructure/persistence/typeorm-api-key.repository';
import { TypeOrmChatRepository } from './infrastructure/persistence/typeorm-chat.repository';
import { TypeOrmCorreoRepository } from './infrastructure/persistence/typeorm-correo.repository';
import { TypeOrmEventoCalendarioRepository } from './infrastructure/persistence/typeorm-evento-calendario.repository';
import { TypeOrmTareaRepository } from './infrastructure/persistence/typeorm-tarea.repository';

/**
 * Herramientas de colaboración: tareas (Kanban), calendario personal, chat
 * interno, correo interno y claves API.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskOrmEntity,
      TaskAssigneeOrmEntity,
      CalendarEventOrmEntity,
      ChatMessageOrmEntity,
      EmailOrmEntity,
      ApiKeyOrmEntity,
    ]),
  ],
  controllers: [
    TareasController,
    CalendarioController,
    ChatController,
    CorreoController,
    ApiKeysController,
    UsuariosColaboracionController,
  ],
  providers: [
    // Tareas
    ListTareasUseCase,
    GetKanbanUseCase,
    GetEstadisticasTareasUseCase,
    GetTareaUseCase,
    GuardarTareaUseCase,
    CambiarEstadoTareaUseCase,
    EliminarTareaUseCase,
    // Calendario
    ListEventosUseCase,
    GuardarEventoUseCase,
    EliminarEventoUseCase,
    // Chat
    ListContactosChatUseCase,
    GetConversacionUseCase,
    EnviarMensajeChatUseCase,
    MarcarConversacionLeidaUseCase,
    // Correo
    ListBuzonUseCase,
    GetCorreoUseCase,
    RedactarCorreoUseCase,
    ContarCorreosNoLeidosUseCase,
    // API keys
    ListApiKeysUseCase,
    CrearApiKeyUseCase,
    RenombrarApiKeyUseCase,
    RegenerarApiKeyUseCase,
    AlternarEstadoApiKeyUseCase,
    EliminarApiKeysUseCase,
    // Usuarios
    ListUsuariosUseCase,
    // Puertos → adaptadores
    { provide: TareaRepository, useClass: TypeOrmTareaRepository },
    { provide: EventoCalendarioRepository, useClass: TypeOrmEventoCalendarioRepository },
    { provide: ChatRepository, useClass: TypeOrmChatRepository },
    { provide: CorreoRepository, useClass: TypeOrmCorreoRepository },
    { provide: ApiKeyRepository, useClass: TypeOrmApiKeyRepository },
    { provide: UsuariosPort, useClass: SqlUsuariosAdapter },
    { provide: EventosSistemaPort, useClass: SqlEventosSistemaAdapter },
    { provide: NotificacionesPort, useClass: SqlNotificacionesAdapter },
  ],
})
export class ColaboracionModule {}
