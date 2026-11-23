import { Injectable } from '@nestjs/common';
import { LlmChatProvider } from '../../domain/ports';

export interface EstadoAsistente {
  configurado: boolean;
  modelo: string;
}

/** Diagnóstico: si hay clave de API y qué modelo se usa (GET asistente/estado). */
@Injectable()
export class EstadoAsistenteUseCase {
  constructor(private readonly llm: LlmChatProvider) {}

  execute(): EstadoAsistente {
    return { configurado: this.llm.isConfigured(), modelo: this.llm.modelName() };
  }
}
