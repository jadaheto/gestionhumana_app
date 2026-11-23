/** Traza de una herramienta ejecutada durante la conversación. */
export interface EjecucionHerramienta {
  herramienta: string;
  argumentos: Record<string, unknown>;
  filas: number | null;
  error: string | null;
  ms: number;
}

export interface UsoTokens {
  promptTokens: number;
  completionTokens: number;
}

export interface RespuestaAsistente {
  /** Respuesta en Markdown. */
  respuesta: string;
  herramientas: EjecucionHerramienta[];
  uso: UsoTokens;
}

export const MENSAJE_NO_CONFIGURADO = 'El asistente no está configurado (falta DEEPSEEK_API_KEY en el entorno).';

/** Falta la clave de API del modelo. → HTTP 503 (lo traduce el controlador). */
export class AsistenteNoConfiguradoError extends Error {
  constructor() {
    super(MENSAJE_NO_CONFIGURADO);
    this.name = 'AsistenteNoConfiguradoError';
  }
}

/** El modelo (o el presupuesto de tiempo) no produjo respuesta; conserva la traza. → HTTP 502 */
export class AsistenteSinRespuestaError extends Error {
  constructor(
    message: string,
    readonly herramientas: EjecucionHerramienta[],
  ) {
    super(message);
    this.name = 'AsistenteSinRespuestaError';
  }
}

/** Fallo al hablar con el proveedor del modelo (red, HTTP, respuesta inválida). */
export class ProveedorLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProveedorLlmError';
  }
}
