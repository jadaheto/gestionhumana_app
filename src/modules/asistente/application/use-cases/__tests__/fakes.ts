import {
  ArgumentosHerramienta,
  AuditoriaAsistente,
  DefinicionHerramienta,
  HerramientasAsistente,
  LlmChatProvider,
  MensajeChat,
  OpcionesChat,
  RegistroAuditoria,
  ResultadoChat,
  ResultadoHerramienta,
} from '../../../domain/ports';

export interface LlamadaChat {
  messages: MensajeChat[];
  tools: DefinicionHerramienta[];
  opts: OpcionesChat;
}

/** Proveedor LLM falso: responde en orden lo programado con `respond()`; registra cada llamada. */
export class FakeLlmChatProvider extends LlmChatProvider {
  configured = true;
  model = 'fake-model';
  readonly calls: LlamadaChat[] = [];
  /** Gancho por llamada (p. ej. avanzar el reloj). */
  onChat: ((call: LlamadaChat) => void) | null = null;
  private readonly queue: (ResultadoChat | Error)[] = [];

  respond(...results: (ResultadoChat | Error)[]): this {
    this.queue.push(...results);
    return this;
  }
  isConfigured(): boolean {
    return this.configured;
  }
  modelName(): string {
    return this.model;
  }
  chat(messages: MensajeChat[], tools: DefinicionHerramienta[], opts: OpcionesChat): Promise<ResultadoChat> {
    const call = { messages: messages.map((m) => ({ ...m })), tools, opts };
    this.calls.push(call);
    this.onChat?.(call);
    const next = this.queue.shift();
    if (!next) return Promise.reject(new Error('sin respuestas programadas'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }
}

export const textoResultado = (content: string, usage = { promptTokens: 10, completionTokens: 5 }): ResultadoChat => ({
  message: { content },
  usage,
});

export const llamadasResultado = (
  calls: { id: string; name: string; arguments: Record<string, unknown> | string }[],
  usage = { promptTokens: 20, completionTokens: 8 },
): ResultadoChat => ({
  message: {
    content: null,
    toolCalls: calls.map((c) => ({
      id: c.id,
      name: c.name,
      arguments: typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments),
    })),
  },
  usage,
});

export class FakeHerramientas extends HerramientasAsistente {
  readonly ejecuciones: { name: string; args: ArgumentosHerramienta }[] = [];
  resultados = new Map<string, ResultadoHerramienta | ((args: ArgumentosHerramienta) => ResultadoHerramienta)>();
  esquema = 'colaboradores(id integer, nombre_completo text)';

  run(name: string, args: ArgumentosHerramienta): Promise<ResultadoHerramienta> {
    this.ejecuciones.push({ name, args });
    const r = this.resultados.get(name);
    if (!r) return Promise.resolve({ error: `Herramienta desconocida: ${name}` });
    return Promise.resolve(typeof r === 'function' ? r(args) : r);
  }
  schemaSummary(): Promise<string> {
    return Promise.resolve(this.esquema);
  }
}

export class AuditoriaEnMemoria extends AuditoriaAsistente {
  readonly registros: RegistroAuditoria[] = [];
  fallar = false;
  registrar(r: RegistroAuditoria): Promise<void> {
    if (this.fallar) return Promise.reject(new Error('BD no disponible'));
    this.registros.push(r);
    return Promise.resolve();
  }
}
