import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditoriaAsistente, RegistroAuditoria } from '../../domain/ports';

/** Guarda cada pregunta en `assistant_messages` (incluye el SQL generado por `consulta_sql`). */
@Injectable()
export class SqlAuditoriaAsistente extends AuditoriaAsistente {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async registrar(r: RegistroAuditoria): Promise<void> {
    const sqlGenerado =
      r.herramientas
        .filter((h) => h.herramienta === 'consulta_sql' && typeof h.argumentos['sql'] === 'string')
        .map((h) => String(h.argumentos['sql']))
        .join(';\n') || null;
    await this.dataSource.query(
      `INSERT INTO assistant_messages
         (user_id, conversation_key, question, answer, sql_generated, tool_calls, model, prompt_tokens, completion_tokens, success, error, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
      [
        r.userId,
        r.conversacion,
        r.pregunta,
        r.respuesta,
        sqlGenerado,
        JSON.stringify(r.herramientas),
        r.modelo,
        r.promptTokens,
        r.completionTokens,
        r.error === null,
        r.error,
        r.duracionMs,
      ],
    );
  }
}
