/* eslint-disable */
/**
 * Registro de eventos de seguridad en la base de logs (esquema `apps`, una tabla por aplicación).
 * Cumple `tools/Seguridad/directrices-logs.md` (secciones 2, 3 y 4) y APP-33 / MON-01.
 *
 * Archivo autónomo: es la MISMA copia en todos los backends (origen: tools/Seguridad/plantillas/security-log.ts).
 * No depende de Nest ni del resto de la aplicación; solo de `pg`.
 *
 * Garantías:
 *  - Si faltan las variables LOGS_DB_* queda apagado y no hace nada.
 *  - Nunca lanza ni retrasa la petición: escribe en segundo plano, con su propia conexión
 *    (fuera de la transacción del negocio). Si la base no responde, el evento sale por stderr.
 *  - Nunca registra cuerpos, cabeceras de autorización, cookies ni la cadena de consulta de la URL.
 *
 * Variables de entorno:
 *   LOGS_DB_HOST, LOGS_DB_PORT (5432), LOGS_DB_NAME (logs), LOGS_DB_USER, LOGS_DB_PASSWORD,
 *   LOGS_DB_SSL (false), LOGS_TABLE (opcional: reemplaza la tabla por defecto).
 */
import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { Pool } from 'pg';

export type SecurityLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface SecurityLogEvent {
  level: SecurityLogLevel;
  msg: string;
  ip?: string | null;
  userId?: string | number | null;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  userAgent?: string | null;
  requestId?: string | null;
  service?: string | null;
  /** Campos propios de la aplicación. Sin secretos ni datos personales. */
  extra?: Record<string, unknown> | null;
}

export interface SecurityLogOptions {
  /** Tabla dentro del esquema `apps` (minúsculas, números y guion bajo). */
  table: string;
  /** Nombre del servicio, si la aplicación tiene varios. */
  service?: string;
  /**
   * Rutas de mucho tráfico cuyas respuestas correctas (< 400) NO se registran (p. ej. jugadas de un juego).
   * Los rechazos y errores de esas rutas sí se registran siempre.
   */
  quietSuccess?: RegExp;
}

interface Row {
  timestamp: string;
  level: SecurityLogLevel;
  msg: string;
  ip: string | null;
  user_id: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  user_agent: string | null;
  request_id: string | null;
  service: string | null;
  extra: string | null;
}

const MAX_QUEUE = 2000;
const BATCH = 100;
const FLUSH_MS = 1000;

let pool: Pool | null = null;
let table = '';
let defaultService: string | null = null;
const queue: Row[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let dropped = 0;
let initialized = false;

const env = (name: string): string => (process.env[name] ?? '').trim();

/** Prepara la conexión. Se puede llamar varias veces; solo la primera cuenta. */
export function initSecurityLog(options: SecurityLogOptions): boolean {
  if (initialized) return pool !== null;
  initialized = true;
  defaultService = options.service ?? null;
  const host = env('LOGS_DB_HOST');
  const user = env('LOGS_DB_USER');
  const name = env('LOGS_TABLE') || options.table;
  if (!host || !user) return false;
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    console.error(`[security-log] nombre de tabla inválido: se deja apagado`);
    return false;
  }
  table = name;
  try {
    pool = new Pool({
      host,
      port: Number(env('LOGS_DB_PORT')) || 5432,
      database: env('LOGS_DB_NAME') || 'logs',
      user,
      password: process.env.LOGS_DB_PASSWORD ?? '',
      ssl: env('LOGS_DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      application_name: `security-log:${name}`,
    });
    // Un corte de la conexión en reposo no debe tumbar el proceso.
    pool.on('error', (err: Error) => console.error(`[security-log] conexión: ${err.message}`));
  } catch (err) {
    pool = null;
    console.error(`[security-log] no se pudo preparar: ${(err as Error).message}`);
  }
  return pool !== null;
}

export function securityLogEnabled(): boolean {
  return pool !== null;
}

const cut = (value: unknown, max: number): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/[\r\n]+/g, ' ').split(String.fromCharCode(0)).join(' ');
  return text.length > max ? text.slice(0, max) : text;
};

const SECRET_KEY = /pass|contrase|clave|secret|token|authorization|cookie|api[-_]?key|otp|codigo|tarjeta|card|cvv|pin\b/i;

/** Quita de `extra` cualquier campo cuyo nombre parezca un secreto (regla 5). */
function cleanExtra(extra: Record<string, unknown> | null | undefined): string | null {
  if (!extra) return null;
  try {
    const text = JSON.stringify(extra, (key, value: unknown) => {
      if (key && SECRET_KEY.test(key)) return '[oculto]';
      if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`;
      if (typeof value === 'bigint') return value.toString();
      return value;
    });
    return text && text !== '{}' ? text.replace(/\\u0000/g, '') : null;
  } catch {
    return null;
  }
}

/** Identifica por id; si lo que llega es un correo, guarda una huella y no el correo (regla 6). */
function cleanUserId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') return null;
  const text = String(value);
  if (text.includes('@')) return `h:${createHash('sha256').update(text.toLowerCase()).digest('hex').slice(0, 16)}`;
  return text.slice(0, 100);
}

function cleanIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let ip = value.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  const zone = ip.indexOf('%');
  if (zone > 0) ip = ip.slice(0, zone);
  return isIP(ip) ? ip : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ruta sin cadena de consulta y sin segmentos que parezcan un token (enlaces de recuperación, JWT…). */
function cleanPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  const end = url.search(/[?#]/);
  const bare = end >= 0 ? url.slice(0, end) : url;
  const safe = bare
    .split('/')
    .map((raw) => {
      // Un token puede llevar extensión (p. ej. /o/<token>.gif): se evalúa sin ella.
      const part = raw.replace(/\.[A-Za-z0-9]{1,5}$/, '');
      if (UUID.test(part)) return raw;
      if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(part) && part.length > 40) return ':oculto';
      return /^[A-Za-z0-9_\-+=~]{24,}$/.test(part) ? ':oculto' : raw;
    })
    .join('/');
  return cut(safe, 512);
}

/** Encola un evento. No lanza nunca. */
export function logSecurityEvent(event: SecurityLogEvent): void {
  try {
    const row: Row = {
      timestamp: new Date().toISOString(),
      level: event.level,
      msg: cut(event.msg, 1000) ?? '',
      ip: cleanIp(event.ip),
      user_id: cleanUserId(event.userId),
      method: cut(event.method, 10),
      path: cleanPath(event.path),
      status: typeof event.status === 'number' && event.status >= 0 && event.status < 1000 ? event.status : null,
      user_agent: cut(event.userAgent, 300),
      request_id: cut(event.requestId, 100),
      service: cut(event.service ?? defaultService, 60),
      extra: cleanExtra(event.extra),
    };
    if (!pool) return;
    if (queue.length >= MAX_QUEUE) {
      // Cola llena (ráfaga o base lenta): se descarta lo más viejo y se avisa una sola vez por tanda,
      // para que una avalancha no frene la aplicación escribiendo en stderr.
      queue.shift();
      dropped++;
    }
    queue.push(row);
    if (queue.length >= BATCH) void flushSecurityLog();
    else schedule();
  } catch (err) {
    console.error(`[security-log] ${(err as Error).message}`);
  }
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushSecurityLog();
  }, FLUSH_MS);
  // El temporizador no debe mantener vivo el proceso (pruebas, scripts).
  timer.unref?.();
}

function toStderr(rows: Row[], reason: string): void {
  for (const row of rows) {
    const { extra, ...rest } = row;
    let parsed: unknown = null;
    try {
      parsed = extra ? JSON.parse(extra) : null;
    } catch {
      parsed = null;
    }
    console.error(JSON.stringify({ ...rest, extra: parsed, security_log: reason }));
  }
}

/** Escribe lo pendiente. Útil antes de apagar; nunca lanza. */
export async function flushSecurityLog(): Promise<void> {
  if (!pool || flushing) return;
  flushing = true;
  if (dropped > 0) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', msg: 'security-log: cola llena, eventos descartados', extra: { descartados: dropped } }));
    dropped = 0;
  }
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, BATCH);
      const values: unknown[] = [];
      const tuples = batch.map((row, i) => {
        const b = i * 12;
        values.push(
          row.timestamp, row.level, row.msg, row.ip, row.user_id, row.method,
          row.path, row.status, row.user_agent, row.request_id, row.service, row.extra,
        );
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12})`;
      });
      try {
        await pool.query(
          `INSERT INTO apps.${table} (timestamp, level, msg, ip, user_id, method, path, status, user_agent, request_id, service, extra) VALUES ${tuples.join(',')}`,
          values,
        );
      } catch (err) {
        // La base no responde: el evento sale por stderr y la aplicación sigue.
        toStderr(batch, `sin base: ${(err as Error).message.slice(0, 120)}`);
      }
    }
  } finally {
    flushing = false;
    if (queue.length > 0) schedule();
  }
}

// ---------------------------------------------------------------------------------------------
// Middleware HTTP (Express)
// ---------------------------------------------------------------------------------------------

interface ReqLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  user?: unknown;
}
interface ResLike {
  statusCode: number;
  headersSent?: boolean;
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): unknown;
  on(event: 'finish', listener: () => void): unknown;
}

const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;

/**
 * Dirección real del cliente (regla 7). Usa `req.ip` (respeta el `trust proxy` de la aplicación);
 * si esa es la del proxy (red privada), toma de X-Forwarded-For la última dirección pública.
 * Solo afecta lo que se registra: no cambia la configuración de la aplicación.
 */
function clientIp(req: ReqLike): string | null {
  const direct = cleanIp(req.ip) ?? cleanIp(req.socket?.remoteAddress);
  if (direct && !PRIVATE_IP.test(direct)) return direct;
  const header = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(header) ? header.join(',') : (header ?? '')).split(',');
  for (let i = chain.length - 1; i >= 0; i--) {
    const hop = cleanIp(chain[i]);
    if (hop && !PRIVATE_IP.test(hop)) return hop;
  }
  return direct;
}

function userIdOf(req: ReqLike): unknown {
  const user = req.user;
  if (!user || typeof user !== 'object') return null;
  const u = user as Record<string, unknown>;
  return (
    u.id ?? u.sub ?? u.userId ?? u.user_id ?? u.usuarioId ?? u.idUsuario ?? u.usuario_id ?? u.uid ?? u.convenioId ?? null
  );
}

// Las mismas rutas que Jano reconoce como inicio de sesión (directrices-logs.md, sección 4).
// Dentro de esas rutas, las que SÍ son el intento de ingreso (no /auth/me, registro, recuperación, refresco…).
const LOGIN_ATTEMPT = /\/(login|signin|ingresar|acceso|session|token|oauth)(\/|$)|\/auth\/?$/i;
const NOT_LOGIN = /(refresh|recuper|restablec|reset|forgot|olvid|registr|register|verif|password|contrasen|logout|salir)/i;
const LOGOUT_PATH = /\/(logout|signout|salir|cerrar-sesion)(\/|$)/i;
const EXPORT_PATH = /(export|descarg|download|backup|respaldo|reporte|report)/i;
const QUIET_PATH = /\/(health|healthz|ping|metrics|favicon\.ico)(\/|$)/i;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function classify(method: string, path: string, status: number): { level: SecurityLogLevel; msg: string } | null {
  if (method === 'OPTIONS') return null;
  if (status >= 500) return { level: 'error', msg: `error interno ${status}` };
  const login = LOGIN_ATTEMPT.test(path) && !NOT_LOGIN.test(path);
  if (status === 401) return { level: 'warn', msg: login && method === 'POST' ? 'login failed' : 'unauthorized' };
  if (status === 403) return { level: 'warn', msg: 'access denied' };
  if (status === 429) return { level: 'warn', msg: 'límite de peticiones superado' };
  if (status === 400 || status === 422) return { level: 'warn', msg: 'validación rechazada' };
  if (status === 404) return { level: 'info', msg: 'ruta o recurso no encontrado' };
  if (status >= 400) return { level: 'warn', msg: `petición rechazada ${status}` };
  if (QUIET_PATH.test(path)) return null;
  if (method === 'POST' && LOGOUT_PATH.test(path)) return { level: 'info', msg: 'cierre de sesión' };
  if (method === 'POST' && login) return { level: 'info', msg: 'inicio de sesión correcto' };
  if (WRITE_METHODS.has(method)) return { level: 'info', msg: `acción ${method}` };
  if (EXPORT_PATH.test(path)) return { level: 'info', msg: 'consulta de exportación o descarga' };
  return null;
}

/**
 * Middleware de Express: registra, al terminar cada respuesta, inicios de sesión (éxito y fallo),
 * accesos denegados, validaciones rechazadas, errores, acciones que cambian datos y exportaciones.
 * Registrar con `app.use(securityLogMiddleware({ table: '<app>' }))` lo más arriba posible en main.ts.
 */
export function securityLogMiddleware(options: SecurityLogOptions) {
  initSecurityLog(options);
  return (req: ReqLike, res: ResLike, next: (err?: unknown) => void): void => {
    if (!pool) {
      next();
      return;
    }
    try {
      const incoming = req.headers['x-request-id'];
      const given = Array.isArray(incoming) ? incoming[0] : incoming;
      const requestId = given && /^[\w.:-]{6,100}$/.test(given) ? given : randomUUID();
      try {
        if (!res.headersSent && !res.getHeader('x-request-id')) res.setHeader('X-Request-Id', requestId);
      } catch {
        /* la cabecera es un extra: si no se puede poner, se sigue */
      }
      const started = Date.now();
      res.on('finish', () => {
        try {
          const method = (req.method ?? '').toUpperCase();
          const url = req.originalUrl ?? req.url ?? '';
          const bare = url.split('?')[0] ?? '';
          const found = classify(method, bare, res.statusCode);
          if (!found) return;
          if (res.statusCode < 400 && options.quietSuccess?.test(bare)) return;
          const agent = req.headers['user-agent'];
          logSecurityEvent({
            level: found.level,
            msg: found.msg,
            ip: clientIp(req),
            userId: userIdOf(req) as string | number | null,
            method,
            path: url,
            status: res.statusCode,
            userAgent: Array.isArray(agent) ? agent[0] : agent,
            requestId,
            extra: { ms: Date.now() - started },
          });
        } catch (err) {
          console.error(`[security-log] ${(err as Error).message}`);
        }
      });
    } catch (err) {
      console.error(`[security-log] ${(err as Error).message}`);
    }
    next();
  };
}

/** Evento de arranque (sección 3: arranque, parada y cambios de configuración). */
export function logAppStart(extra?: Record<string, unknown>): void {
  logSecurityEvent({
    level: 'info',
    msg: 'arranque de la aplicación',
    extra: { node: process.version, env: process.env.NODE_ENV ?? null, ...extra },
  });
}

/** Evento de parada. Llamar desde un gancho de apagado que la aplicación YA tenga. */
export async function logAppStop(signal?: string): Promise<void> {
  logSecurityEvent({ level: 'info', msg: 'parada de la aplicación', extra: { signal: signal ?? null } });
  await flushSecurityLog();
}
