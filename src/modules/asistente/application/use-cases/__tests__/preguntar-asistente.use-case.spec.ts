import type { Actor } from '../../../../../shared/domain/actor';
import { ValidationError } from '../../../../../shared/domain/domain-error';
import { FakeClock } from '../../../../../shared/testing/fakes';
import { AsistenteNoConfiguradoError, AsistenteSinRespuestaError } from '../../../domain/respuesta';
import {
  MAX_RONDAS_HERRAMIENTAS,
  MENSAJE_SIN_RESPUESTA,
  MENSAJE_TIEMPO_EXCEDIDO,
  PreguntarAsistenteUseCase,
  TURNOS_HISTORIAL,
} from '../preguntar-asistente.use-case';
import { AuditoriaEnMemoria, FakeHerramientas, FakeLlmChatProvider, llamadasResultado, textoResultado } from './fakes';

const admin: Actor = {
  id: 7,
  username: 'admin',
  firstName: 'Camilo Andrés',
  lastName: 'Vides',
  email: 'a@x.co',
  role: 'admin',
};

describe('PreguntarAsistenteUseCase', () => {
  let llm: FakeLlmChatProvider;
  let herramientas: FakeHerramientas;
  let auditoria: AuditoriaEnMemoria;
  let clock: FakeClock;
  let uc: PreguntarAsistenteUseCase;

  beforeEach(() => {
    llm = new FakeLlmChatProvider();
    herramientas = new FakeHerramientas();
    auditoria = new AuditoriaEnMemoria();
    clock = new FakeClock(new Date('2026-10-26T15:00:00.000Z'));
    uc = new PreguntarAsistenteUseCase(llm, herramientas, auditoria, clock);
  });

  it('sin clave falla como no configurado, sin llamar al modelo', async () => {
    llm.configured = false;
    await expect(uc.execute(admin, { pregunta: 'hola' })).rejects.toThrow(AsistenteNoConfiguradoError);
    expect(llm.calls).toHaveLength(0);
  });

  it('valida la pregunta (vacía o > 4000 caracteres)', async () => {
    await expect(uc.execute(admin, { pregunta: '   ' })).rejects.toThrow(ValidationError);
    await expect(uc.execute(admin, { pregunta: 'x'.repeat(4001) })).rejects.toThrow(ValidationError);
    expect(llm.calls).toHaveLength(0);
  });

  it('ejecuta las herramientas que pide el modelo, arma la traza, suma tokens y audita', async () => {
    herramientas.resultados.set('buscar_colaborador', { filas: 1, colaboradores: [{ id: 3 }] });
    herramientas.resultados.set('ficha_colaborador', (args) => ({
      filas: 1,
      colaborador: { id: args['colaborador_id'] },
    }));
    llm
      .respond(llamadasResultado([{ id: 'c1', name: 'buscar_colaborador', arguments: { texto: 'Ana' } }]))
      .respond(
        llamadasResultado([{ id: 'c2', name: 'ficha_colaborador', arguments: '{"colaborador_id": 3}' }], {
          promptTokens: 30,
          completionTokens: 4,
        }),
      )
      .respond(textoResultado('Ana es **Analista**.', { promptTokens: 40, completionTokens: 12 }));

    const r = await uc.execute(admin, { pregunta: '¿Qué cargo tiene Ana?', conversacion: 'c-abc' });

    expect(r.respuesta).toBe('Ana es **Analista**.');
    expect(r.uso).toEqual({ promptTokens: 90, completionTokens: 24 });
    expect(r.herramientas).toEqual([
      { herramienta: 'buscar_colaborador', argumentos: { texto: 'Ana' }, filas: 1, error: null, ms: 0 },
      { herramienta: 'ficha_colaborador', argumentos: { colaborador_id: 3 }, filas: 1, error: null, ms: 0 },
    ]);
    expect(herramientas.ejecuciones.map((e) => e.name)).toEqual(['buscar_colaborador', 'ficha_colaborador']);
    // Secuencia de mensajes del último turno: system, user, assistant(tool_calls), tool, assistant, tool.
    const ultimo = llm.calls[2].messages;
    expect(ultimo.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'tool']);
    expect(ultimo[3].toolCallId).toBe('c1');
    expect(ultimo[0].content).toContain('llamado Camilo.');
    expect(ultimo[0].content).toContain(`Hoy es ${clock.today()}`);
    expect(ultimo[0].content).toContain(herramientas.esquema);
    expect(llm.calls[0].opts).toEqual({ timeoutMs: 60_000 });

    expect(auditoria.registros).toHaveLength(1);
    expect(auditoria.registros[0]).toMatchObject({
      userId: 7,
      conversacion: 'c-abc',
      pregunta: '¿Qué cargo tiene Ana?',
      respuesta: 'Ana es **Analista**.',
      modelo: 'fake-model',
      promptTokens: 90,
      error: null,
    });
    expect(auditoria.registros[0].herramientas).toHaveLength(2);
  });

  it('argumentos mal formados y herramientas desconocidas no rompen el bucle', async () => {
    llm
      .respond(llamadasResultado([{ id: 'c1', name: 'inexistente', arguments: '{no json' }]))
      .respond(textoResultado('Listo.'));
    const r = await uc.execute(admin, { pregunta: 'dame datos de pedro' });
    expect(r.herramientas).toEqual([
      { herramienta: 'inexistente', argumentos: {}, filas: null, error: 'Herramienta desconocida: inexistente', ms: 0 },
    ]);
    expect(r.respuesta).toBe('Listo.');
  });

  it('reintenta con tool_choice required si respondió sin herramientas y suma los tokens', async () => {
    herramientas.resultados.set('consulta_sql', { filas: 3, datos: [] });
    llm
      .respond(textoResultado('Hay 10 colaboradores (de memoria).', { promptTokens: 10, completionTokens: 5 }))
      .respond(
        llamadasResultado(
          [{ id: 'c1', name: 'consulta_sql', arguments: { sql: 'SELECT 1 FROM colaboradores', proposito: 'contar' } }],
          { promptTokens: 20, completionTokens: 8 },
        ),
      )
      .respond(textoResultado('Hay 3 colaboradores.', { promptTokens: 30, completionTokens: 6 }));
    const r = await uc.execute(admin, { pregunta: '¿Cuántos colaboradores hay?' });
    expect(llm.calls).toHaveLength(3);
    expect(llm.calls[1].opts.toolChoice).toBe('required');
    expect(llm.calls[2].opts.toolChoice).toBeUndefined();
    expect(r.respuesta).toBe('Hay 3 colaboradores.');
    expect(r.uso).toEqual({ promptTokens: 60, completionTokens: 19 });
  });

  it('si el reintento forzado falla conserva la primera respuesta', async () => {
    llm.respond(textoResultado('Respuesta inicial.')).respond(new Error('modelo caído'));
    const r = await uc.execute(admin, { pregunta: '¿Cuántos colaboradores hay?' });
    expect(r.respuesta).toBe('Respuesta inicial.');
    expect(llm.calls).toHaveLength(2);
  });

  it('un saludo no reintenta con herramientas', async () => {
    llm.respond(textoResultado('¡Hola! ¿En qué te ayudo?'));
    const r = await uc.execute(admin, { pregunta: 'Hola!' });
    expect(r.respuesta).toContain('Hola');
    expect(llm.calls).toHaveLength(1);
  });

  it('normaliza el historial: últimos 12 turnos, 6000 caracteres y roles válidos', async () => {
    llm.respond(textoResultado('ok'));
    const historial = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'system',
      content: `m${i}`,
    }));
    historial.push({ role: 'user', content: 'x'.repeat(7000) }, { role: 'user', content: '   ' });
    await uc.execute(admin, { pregunta: 'gracias', historial });
    const msgs = llm.calls[0].messages;
    expect(msgs).toHaveLength(1 + TURNOS_HISTORIAL + 1);
    expect(msgs[1].role).toBe('assistant'); // historial[9]
    expect(msgs[2].role).toBe('user'); // historial[10] era 'system': se degrada a user
    expect(msgs[TURNOS_HISTORIAL].content).toHaveLength(6000);
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'gracias' });
  });

  it('la última ronda va sin herramientas y sin texto falla con la traza', async () => {
    herramientas.resultados.set('consulta_sql', { filas: 0 });
    for (let i = 0; i < MAX_RONDAS_HERRAMIENTAS; i++) {
      llm.respond(
        llamadasResultado([{ id: `c${i}`, name: 'consulta_sql', arguments: { sql: 'SELECT 1 FROM colaboradores' } }]),
      );
    }
    llm.respond(textoResultado('   '));
    const err: unknown = await uc.execute(admin, { pregunta: 'ranking de puntos' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AsistenteSinRespuestaError);
    expect((err as AsistenteSinRespuestaError).message).toBe(MENSAJE_SIN_RESPUESTA);
    expect((err as AsistenteSinRespuestaError).herramientas).toHaveLength(MAX_RONDAS_HERRAMIENTAS);
    expect(llm.calls[MAX_RONDAS_HERRAMIENTAS].tools).toEqual([]);
    expect(llm.calls[0].tools.length).toBeGreaterThan(0);
    expect(auditoria.registros[0].error).toBe(MENSAJE_SIN_RESPUESTA);
  });

  it('corta por presupuesto de tiempo y acota el timeout por llamada a min(60 s, restante)', async () => {
    herramientas.resultados.set('consulta_sql', { filas: 1 });
    llm.onChat = () => clock.set(new Date(clock.now().getTime() + 100_000));
    llm.respond(
      llamadasResultado([{ id: 'c1', name: 'consulta_sql', arguments: { sql: 'SELECT 1 FROM colaboradores' } }]),
    );
    llm.respond(
      llamadasResultado([{ id: 'c2', name: 'consulta_sql', arguments: { sql: 'SELECT 2 FROM colaboradores' } }]),
    );
    const err: unknown = await uc.execute(admin, { pregunta: 'ranking' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AsistenteSinRespuestaError);
    expect((err as AsistenteSinRespuestaError).message).toBe(MENSAJE_TIEMPO_EXCEDIDO);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0].opts.timeoutMs).toBe(60_000);
    expect(llm.calls[1].opts.timeoutMs).toBe(50_000);
    expect(auditoria.registros[0].duracionMs).toBe(200_000);
  });

  it('un error del proveedor conserva las herramientas ejecutadas', async () => {
    herramientas.resultados.set('buscar_colaborador', { filas: 0 });
    llm
      .respond(llamadasResultado([{ id: 'c1', name: 'buscar_colaborador', arguments: { texto: 'x' } }]))
      .respond(new Error('Sin respuesta de DeepSeek: red'));
    const err: unknown = await uc.execute(admin, { pregunta: 'busca x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AsistenteSinRespuestaError);
    expect((err as AsistenteSinRespuestaError).message).toBe('Sin respuesta de DeepSeek: red');
    expect((err as AsistenteSinRespuestaError).herramientas).toHaveLength(1);
  });

  it('la auditoría que falla no rompe la respuesta', async () => {
    auditoria.fallar = true;
    llm.respond(textoResultado('Hola.'));
    await expect(uc.execute(admin, { pregunta: 'hola' })).resolves.toMatchObject({ respuesta: 'Hola.' });
  });
});
