import { EjecucionHerramienta } from './respuesta';

// ── Proveedor del modelo ──

export type RolChat = 'system' | 'user' | 'assistant' | 'tool';

export interface LlamadaHerramienta {
  id: string;
  name: string;
  /** JSON serializado tal como lo devuelve el modelo. */
  arguments: string;
}

export interface MensajeChat {
  role: RolChat;
  content: string | null;
  toolCalls?: LlamadaHerramienta[];
  toolCallId?: string;
}

/** Definición de herramienta (JSON Schema) en el formato OpenAI / DeepSeek. */
export interface DefinicionHerramienta {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpcionesChat {
  toolChoice?: 'auto' | 'required';
  timeoutMs: number;
}

export interface ResultadoChat {
  message: { content: string | null; toolCalls?: LlamadaHerramienta[] };
  usage: { promptTokens: number; completionTokens: number };
}

/** Proveedor de chat compatible con OpenAI (DeepSeek por defecto). Sin streaming. */
export abstract class LlmChatProvider {
  abstract isConfigured(): boolean;
  abstract modelName(): string;
  abstract chat(messages: MensajeChat[], tools: DefinicionHerramienta[], opts: OpcionesChat): Promise<ResultadoChat>;
}

// ── Herramientas de dominio (solo lectura) ──

export type ArgumentosHerramienta = Record<string, unknown>;

/** Resultado serializable que se devuelve al modelo. `filas`/`total` alimentan la traza. */
export interface ResultadoHerramienta {
  [key: string]: unknown;
  error?: string;
  filas?: number;
  total?: number;
}

export abstract class HerramientasAsistente {
  abstract run(name: string, args: ArgumentosHerramienta): Promise<ResultadoHerramienta>;
  /** Resumen `tabla(col tipo, …)` de las tablas permitidas para el prompt del sistema. */
  abstract schemaSummary(): Promise<string>;
}

// ── Auditoría ──

/** Una fila de `assistant_messages`. */
export interface RegistroAuditoria {
  userId: number;
  conversacion: string | null;
  pregunta: string;
  respuesta: string | null;
  herramientas: EjecucionHerramienta[];
  modelo: string;
  promptTokens: number;
  completionTokens: number;
  duracionMs: number;
  error: string | null;
}

export abstract class AuditoriaAsistente {
  abstract registrar(registro: RegistroAuditoria): Promise<void>;
}
