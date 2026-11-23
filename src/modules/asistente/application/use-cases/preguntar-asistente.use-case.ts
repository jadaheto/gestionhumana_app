import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import type { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { esCharla } from '../../domain/charla';
import { HERRAMIENTAS_ASISTENTE } from '../../domain/herramientas';
import {
  ArgumentosHerramienta,
  AuditoriaAsistente,
  DefinicionHerramienta,
  HerramientasAsistente,
  LlmChatProvider,
  MensajeChat,
  ResultadoChat,
} from '../../domain/ports';
import {
  AsistenteNoConfiguradoError,
  AsistenteSinRespuestaError,
  EjecucionHerramienta,
  RespuestaAsistente,
  UsoTokens,
} from '../../domain/respuesta';
import { construirPrompt } from '../prompt';

export const MAX_RONDAS_HERRAMIENTAS = 6;
export const PRESUPUESTO_S = 150;
export const MAX_PREGUNTA = 4000;
export const TURNOS_HISTORIAL = 12;
export const CARACTERES_HISTORIAL = 6000;
/** Margen mínimo para intentar otra llamada al modelo. */
const MIN_RESTANTE_S = 8;
/** Tope por llamada al modelo. */
const MAX_LLAMADA_S = 60;
/** No se reintenta con herramientas forzadas pasado este tiempo. */
const LIMITE_REINTENTO_S = 70;

export const MENSAJE_PREGUNTA_INVALIDA = 'Escribe una pregunta (máximo 4000 caracteres).';
export const MENSAJE_SIN_RESPUESTA = 'El asistente no produjo una respuesta. Intenta reformular la pregunta.';
export const MENSAJE_TIEMPO_EXCEDIDO = `La consulta tardó demasiado (más de ${PRESUPUESTO_S} s). Intenta una pregunta más acotada.`;

export interface TurnoHistorial {
  role: string;
  content: string;
}

export interface PreguntarAsistenteInput {
  pregunta: string;
  historial?: TurnoHistorial[];
  conversacion?: string | null;
}

interface Corrida {
  respuesta: string;
  error: string;
  herramientas: EjecucionHerramienta[];
  uso: UsoTokens;
}

/**
 * Bucle de conversación con herramientas: hasta MAX_RONDAS_HERRAMIENTAS rondas con
 * herramientas y una última solo de texto, reintento con `tool_choice: required`
 * cuando el modelo respondió "de memoria", presupuesto total de tiempo y auditoría
 * que nunca rompe la respuesta.
 */
@Injectable()
export class PreguntarAsistenteUseCase {
  private readonly logger = new Logger(PreguntarAsistenteUseCase.name);

  constructor(
    private readonly llm: LlmChatProvider,
    private readonly herramientas: HerramientasAsistente,
    private readonly auditoria: AuditoriaAsistente,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Actor, input: PreguntarAsistenteInput): Promise<RespuestaAsistente> {
    if (!this.llm.isConfigured()) throw new AsistenteNoConfiguradoError();
    const pregunta = (input.pregunta ?? '').trim();
    if (!pregunta || pregunta.length > MAX_PREGUNTA) throw new ValidationError(MENSAJE_PREGUNTA_INVALIDA);

    const inicio = this.clock.now().getTime();
    const transcurridoS = (): number => (this.clock.now().getTime() - inicio) / 1000;
    const esquema = await this.herramientas.schemaSummary();
    const mensajes: MensajeChat[] = [
      { role: 'system', content: construirPrompt(actor.firstName, this.clock.today(), esquema) },
      ...this.normalizarHistorial(input.historial),
      { role: 'user', content: pregunta },
    ];
    const definiciones = [...HERRAMIENTAS_ASISTENTE];

    let corrida = await this.conversar(mensajes, definiciones, false, transcurridoS);
    // Reintento forzando herramientas cuando el modelo respondió sin consultar nada.
    if (
      !corrida.error &&
      corrida.herramientas.length === 0 &&
      !esCharla(pregunta) &&
      transcurridoS() < LIMITE_REINTENTO_S
    ) {
      const reintento = await this.conversar(mensajes, definiciones, true, transcurridoS);
      if (!reintento.error && reintento.respuesta) {
        reintento.uso.promptTokens += corrida.uso.promptTokens;
        reintento.uso.completionTokens += corrida.uso.completionTokens;
        corrida = reintento;
      }
    }
    if (!corrida.respuesta && !corrida.error) corrida.error = MENSAJE_SIN_RESPUESTA;

    await this.registrarAuditoria(actor, input, pregunta, corrida, Math.round(transcurridoS() * 1000));
    if (corrida.error) throw new AsistenteSinRespuestaError(corrida.error, corrida.herramientas);
    return { respuesta: corrida.respuesta, herramientas: corrida.herramientas, uso: corrida.uso };
  }

  private normalizarHistorial(historial: TurnoHistorial[] | undefined): MensajeChat[] {
    if (!Array.isArray(historial)) return [];
    return historial
      .filter((h) => h && typeof h.content === 'string' && h.content.trim() !== '')
      .slice(-TURNOS_HISTORIAL)
      .map((h) => ({
        role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: h.content.slice(0, CARACTERES_HISTORIAL),
      }));
  }

  private async conversar(
    base: MensajeChat[],
    definiciones: DefinicionHerramienta[],
    forzarPrimera: boolean,
    transcurridoS: () => number,
  ): Promise<Corrida> {
    const mensajes = [...base];
    const corrida: Corrida = {
      respuesta: '',
      error: '',
      herramientas: [],
      uso: { promptTokens: 0, completionTokens: 0 },
    };
    for (let ronda = 0; ronda <= MAX_RONDAS_HERRAMIENTAS; ronda++) {
      const restante = PRESUPUESTO_S - transcurridoS();
      if (restante < MIN_RESTANTE_S) {
        corrida.error = MENSAJE_TIEMPO_EXCEDIDO;
        break;
      }
      const opts = {
        timeoutMs: Math.floor(Math.min(MAX_LLAMADA_S, restante) * 1000),
        ...(ronda === 0 && forzarPrimera ? { toolChoice: 'required' as const } : {}),
      };
      let resultado: ResultadoChat;
      try {
        resultado = await this.llm.chat(mensajes, ronda < MAX_RONDAS_HERRAMIENTAS ? definiciones : [], opts);
      } catch (e) {
        corrida.error = e instanceof Error ? e.message : String(e);
        break;
      }
      corrida.uso.promptTokens += resultado.usage.promptTokens;
      corrida.uso.completionTokens += resultado.usage.completionTokens;
      const { message } = resultado;
      if (message.toolCalls && message.toolCalls.length > 0) {
        mensajes.push({ role: 'assistant', content: message.content ?? '', toolCalls: message.toolCalls });
        for (const llamada of message.toolCalls) {
          const args = parsearArgumentos(llamada.arguments);
          const t0 = this.clock.now().getTime();
          const salida = await this.herramientas.run(llamada.name, args);
          corrida.herramientas.push({
            herramienta: llamada.name,
            argumentos: args,
            filas: numeroONull(salida.filas ?? salida.total),
            error: typeof salida.error === 'string' ? salida.error : null,
            ms: this.clock.now().getTime() - t0,
          });
          mensajes.push({ role: 'tool', toolCallId: llamada.id, content: JSON.stringify(salida) });
        }
        continue;
      }
      corrida.respuesta = (message.content ?? '').trim();
      break;
    }
    return corrida;
  }

  /** La auditoría nunca debe romper la respuesta al usuario. */
  private async registrarAuditoria(
    actor: Actor,
    input: PreguntarAsistenteInput,
    pregunta: string,
    corrida: Corrida,
    duracionMs: number,
  ): Promise<void> {
    try {
      await this.auditoria.registrar({
        userId: actor.id,
        conversacion: input.conversacion ? String(input.conversacion).slice(0, 64) : null,
        pregunta,
        respuesta: corrida.respuesta || null,
        herramientas: corrida.herramientas,
        modelo: this.llm.modelName().slice(0, 60),
        promptTokens: corrida.uso.promptTokens,
        completionTokens: corrida.uso.completionTokens,
        duracionMs,
        error: corrida.error || null,
      });
    } catch (e) {
      this.logger.error(`No se pudo guardar la auditoría del asistente: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function parsearArgumentos(raw: string): ArgumentosHerramienta {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ArgumentosHerramienta) : {};
  } catch {
    return {};
  }
}

function numeroONull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
