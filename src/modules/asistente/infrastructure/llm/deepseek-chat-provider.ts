import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../config/configuration';
import {
  DefinicionHerramienta,
  LlamadaHerramienta,
  LlmChatProvider,
  MensajeChat,
  OpcionesChat,
  ResultadoChat,
} from '../../domain/ports';
import { ProveedorLlmError } from '../../domain/respuesta';

interface ApiMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface ApiResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

const MIN_TIMEOUT_MS = 5000;

/**
 * Cliente mínimo de chat/completions (DeepSeek u otro proveedor compatible con OpenAI)
 * sobre `fetch`. Sin streaming. La clave vive solo en el entorno (DEEPSEEK_API_KEY).
 */
@Injectable()
export class DeepseekChatProvider extends LlmChatProvider {
  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  private get cfg(): AppConfig['asistente'] {
    return this.config.get('asistente', { infer: true });
  }

  isConfigured(): boolean {
    return this.cfg.apiKey.trim() !== '';
  }

  modelName(): string {
    return this.cfg.model;
  }

  async chat(messages: MensajeChat[], tools: DefinicionHerramienta[], opts: OpcionesChat): Promise<ResultadoChat> {
    const cfg = this.cfg;
    if (!this.isConfigured()) throw new ProveedorLlmError('DEEPSEEK_API_KEY no está configurada.');
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: messages.map(aMensajeApi),
      temperature: 0.3,
      max_tokens: 1800,
      stream: false,
    };
    if (tools.length > 0) {
      body['tools'] = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body['tool_choice'] = opts.toolChoice === 'required' ? 'required' : 'auto';
    }
    const timeoutMs = Math.max(MIN_TIMEOUT_MS, opts.timeoutMs ?? cfg.timeoutMs);
    const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    let status: number;
    let texto: string;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = res.status;
      texto = await res.text();
    } catch (e) {
      throw new ProveedorLlmError(`Sin respuesta de DeepSeek: ${e instanceof Error ? e.message : String(e)}`);
    }

    let data: ApiResponse | null = null;
    try {
      data = JSON.parse(texto) as ApiResponse;
    } catch {
      data = null;
    }
    if (status < 200 || status >= 300 || data === null || typeof data !== 'object') {
      throw new ProveedorLlmError(`DeepSeek respondió HTTP ${status}: ${data?.error?.message ?? texto.slice(0, 300)}`);
    }
    const message = data.choices?.[0]?.message;
    if (!message || typeof message !== 'object') throw new ProveedorLlmError('Respuesta de DeepSeek sin mensaje.');
    const toolCalls: LlamadaHerramienta[] = (message.tool_calls ?? [])
      .filter((tc) => tc?.function?.name)
      .map((tc) => ({ id: tc.id ?? '', name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' }));
    return {
      message: { content: message.content ?? null, ...(toolCalls.length ? { toolCalls } : {}) },
      usage: {
        promptTokens: Number(data.usage?.prompt_tokens ?? 0),
        completionTokens: Number(data.usage?.completion_tokens ?? 0),
      },
    };
  }
}

function aMensajeApi(m: MensajeChat): ApiMessage {
  const out: ApiMessage = { role: m.role, content: m.content };
  if (m.toolCalls?.length) {
    out.tool_calls = m.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }
  if (m.role === 'tool') out.tool_call_id = m.toolCallId ?? '';
  return out;
}
