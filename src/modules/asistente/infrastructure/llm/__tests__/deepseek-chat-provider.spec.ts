import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../../config/configuration';
import { ProveedorLlmError } from '../../../domain/respuesta';
import { DeepseekChatProvider } from '../deepseek-chat-provider';

const base = { apiKey: 'sk-test', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/', timeoutMs: 30000 };
const proveedor = (cfg = base): DeepseekChatProvider =>
  new DeepseekChatProvider({ get: () => cfg } as unknown as ConfigService<AppConfig, true>);

describe('DeepseekChatProvider', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  const responder = (status: number, body: unknown): void => {
    fetchMock.mockResolvedValue({
      status,
      text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    });
  };

  it('sin clave no está configurado y no llama a la red', async () => {
    const p = proveedor({ ...base, apiKey: ' ' });
    expect(p.isConfigured()).toBe(false);
    expect(p.modelName()).toBe('deepseek-chat');
    await expect(p.chat([{ role: 'user', content: 'hola' }], [], { timeoutMs: 10_000 })).rejects.toThrow(
      ProveedorLlmError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía un cuerpo compatible con OpenAI y parsea herramientas y uso', async () => {
    responder(200, {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'call_1', function: { name: 'buscar_colaborador', arguments: '{"texto":"ana"}' } },
              { function: {} },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    const r = await proveedor().chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c0', name: 'x', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c0', content: '{}' },
        { role: 'user', content: 'hola' },
      ],
      [{ name: 'buscar_colaborador', description: 'd', parameters: { type: 'object' } }],
      { timeoutMs: 20_000, toolChoice: 'required' },
    );
    expect(r).toEqual({
      message: {
        content: null,
        toolCalls: [{ id: 'call_1', name: 'buscar_colaborador', arguments: '{"texto":"ana"}' }],
      },
      usage: { promptTokens: 12, completionTokens: 3 },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers['Authorization']).toBe('Bearer sk-test');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 1800,
      stream: false,
      tool_choice: 'required',
    });
    expect(body['tools']).toEqual([
      { type: 'function', function: { name: 'buscar_colaborador', description: 'd', parameters: { type: 'object' } } },
    ]);
    const mensajes = body['messages'] as Record<string, unknown>[];
    expect(mensajes[1]['tool_calls']).toEqual([
      { id: 'c0', type: 'function', function: { name: 'x', arguments: '{}' } },
    ]);
    expect(mensajes[2]['tool_call_id']).toBe('c0');
  });

  it('sin herramientas no envía tools ni tool_choice', async () => {
    responder(200, { choices: [{ message: { content: 'Hola' } }] });
    const r = await proveedor().chat([{ role: 'user', content: 'hola' }], [], { timeoutMs: 10_000 });
    expect(r).toEqual({ message: { content: 'Hola' }, usage: { promptTokens: 0, completionTokens: 0 } });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body) as Record<string, unknown>;
    expect(body['tools']).toBeUndefined();
    expect(body['tool_choice']).toBeUndefined();
  });

  it('traduce errores HTTP, respuestas inválidas y fallos de red', async () => {
    const p = proveedor();
    responder(401, { error: { message: 'clave inválida' } });
    await expect(p.chat([{ role: 'user', content: 'x' }], [], { timeoutMs: 10_000 })).rejects.toThrow(
      'DeepSeek respondió HTTP 401: clave inválida',
    );
    responder(200, 'no es json');
    await expect(p.chat([{ role: 'user', content: 'x' }], [], { timeoutMs: 10_000 })).rejects.toThrow(
      'DeepSeek respondió HTTP 200',
    );
    responder(200, { choices: [] });
    await expect(p.chat([{ role: 'user', content: 'x' }], [], { timeoutMs: 10_000 })).rejects.toThrow(
      'Respuesta de DeepSeek sin mensaje.',
    );
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(p.chat([{ role: 'user', content: 'x' }], [], { timeoutMs: 10_000 })).rejects.toThrow(
      'Sin respuesta de DeepSeek: timeout',
    );
  });
});
