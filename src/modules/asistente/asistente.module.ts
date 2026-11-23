import { Module } from '@nestjs/common';
import { EstadoAsistenteUseCase } from './application/use-cases/estado-asistente.use-case';
import { PreguntarAsistenteUseCase } from './application/use-cases/preguntar-asistente.use-case';
import { AuditoriaAsistente, HerramientasAsistente, LlmChatProvider } from './domain/ports';
import { AsistenteController } from './infrastructure/http/asistente.controller';
import { LimiteFrecuenciaGuard } from './infrastructure/http/limite-frecuencia.guard';
import { DeepseekChatProvider } from './infrastructure/llm/deepseek-chat-provider';
import { SqlAuditoriaAsistente } from './infrastructure/persistence/sql-auditoria-asistente';
import { SqlHerramientasAsistente } from './infrastructure/persistence/sql-herramientas-asistente';

/**
 * Asistente IA "Ask AI": chat para administradores que responde sobre los datos de
 * Gestión Humana consultando la base con herramientas de SOLO LECTURA (herramientas
 * acotadas + sandbox SQL sobre una lista blanca). Cada pregunta se audita en
 * `assistant_messages`. `Clock` viene de SharedModule (global).
 */
@Module({
  controllers: [AsistenteController],
  providers: [
    { provide: LlmChatProvider, useClass: DeepseekChatProvider },
    { provide: HerramientasAsistente, useClass: SqlHerramientasAsistente },
    { provide: AuditoriaAsistente, useClass: SqlAuditoriaAsistente },
    EstadoAsistenteUseCase,
    PreguntarAsistenteUseCase,
    LimiteFrecuenciaGuard,
  ],
})
export class AsistenteModule {}
