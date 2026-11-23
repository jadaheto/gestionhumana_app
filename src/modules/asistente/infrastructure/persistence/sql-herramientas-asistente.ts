import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Clock, toIsoDate } from '../../../../shared/application/ports/clock.port';
import { ArgumentosHerramienta, HerramientasAsistente, ResultadoHerramienta } from '../../domain/ports';
import { MAX_FILAS, TABLAS_PERMITIDAS, ValidadorSqlSoloLectura } from '../../domain/validador-sql';

const TTL_ESQUEMA_MS = 60 * 60 * 1000;
const TIMEOUT_SENTENCIA_MS = 6000;
const MAX_TEXTO = 300;
type Fila = Record<string, unknown>;

const FICHA_COLUMNAS = `id, nombre_completo, cedula, codigo_empresa, email, role, estado_colaborador, cargo, area, sede,
  fecha_ingreso, fecha_nacimiento, genero, estado_civil, ciudad, direccion, telefono, celular,
  eps, arl, fondo_pension, caja_compensacion, tipo_sangre, numero_hijos`;

/**
 * Herramientas de dominio del asistente: SQL parametrizado, límites de filas y el
 * sandbox de `consulta_sql` (validador + transacción READ ONLY con statement_timeout
 * + LIMIT forzado). Todo lee la vista `colaboradores`, nunca la tabla `users`.
 */
@Injectable()
export class SqlHerramientasAsistente extends HerramientasAsistente {
  private readonly logger = new Logger(SqlHerramientasAsistente.name);
  private readonly validador = new ValidadorSqlSoloLectura(TABLAS_PERMITIDAS);
  private cacheEsquema: { texto: string; expira: number } | null = null;
  private cacheTablas: { nombres: string[]; expira: number } | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {
    super();
  }

  async run(name: string, args: ArgumentosHerramienta): Promise<ResultadoHerramienta> {
    try {
      switch (name) {
        case 'buscar_colaborador':
          return await this.buscarColaborador(s(args['texto']));
        case 'ficha_colaborador':
          return await this.fichaColaborador(i(args['colaborador_id']));
        case 'ausencias_colaborador':
          return await this.ausenciasColaborador(i(args['colaborador_id']));
        case 'asistencia_colaborador':
          return await this.asistenciaColaborador(i(args['colaborador_id']), s(args['desde']), s(args['hasta']));
        case 'contratos_por_vencer':
          return await this.contratosPorVencer(i(args['dias']));
        case 'consulta_sql':
          return await this.consultaSql(s(args['sql']));
        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Asistente: herramienta ${name} falló: ${msg}`);
      return { error: `Error interno al ejecutar ${name}: ${msg}` };
    }
  }

  /** Resumen del esquema permitido para el prompt (cacheado 1 h). */
  async schemaSummary(): Promise<string> {
    const ahora = Date.now();
    if (this.cacheEsquema && this.cacheEsquema.expira > ahora) return this.cacheEsquema.texto;
    const filas = await this.q<{ table_name: string; cols: string }>(
      `SELECT table_name, STRING_AGG(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS cols
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1)
       GROUP BY table_name ORDER BY table_name`,
      [[...TABLAS_PERMITIDAS]],
    );
    const texto = filas
      .map(
        (r) =>
          `${r.table_name}(${r.cols
            .replace(/character varying/g, 'varchar')
            .replace(/timestamp without time zone/g, 'timestamp')
            .replace(/timestamp with time zone/g, 'timestamptz')
            .replace(/time without time zone/g, 'time')
            .replace(/double precision/g, 'double')})`,
      )
      .join('\n');
    this.cacheEsquema = { texto, expira: ahora + TTL_ESQUEMA_MS };
    return texto;
  }

  private q<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dataSource.query<T[]>(sql, params);
  }

  private async buscarColaborador(texto: string): Promise<ResultadoHerramienta> {
    if (texto.length < 2) return { error: 'Indica al menos 2 caracteres para buscar.' };
    const like = `%${texto.replace(/[%_\\]/g, '\\$&')}%`;
    const filas = await this.q(
      `SELECT id, nombre_completo, cedula, codigo_empresa, email, cargo, area, sede, estado_colaborador
       FROM colaboradores
       WHERE cedula = $1 OR codigo_empresa = $1 OR nombre_completo ILIKE $2 OR email ILIKE $2 OR cedula ILIKE $2
       ORDER BY (cedula = $1) DESC, (estado_colaborador = 'activo') DESC, nombre_completo
       LIMIT 10`,
      [texto, like],
    );
    return { filas: filas.length, colaboradores: filas.map(limpiar) };
  }

  private async fichaColaborador(id: number): Promise<ResultadoHerramienta> {
    if (id <= 0) return { error: 'colaborador_id inválido. Usa buscar_colaborador primero.' };
    const [ficha] = await this.q(`SELECT ${FICHA_COLUMNAS} FROM colaboradores WHERE id = $1`, [id]);
    if (!ficha) return { error: `No existe un colaborador con id ${id}.` };
    const [contrato] = await this.q(
      `SELECT tipo_contrato, numero_contrato, fecha_inicio, fecha_fin, salario_base, estado
       FROM contratos WHERE user_id = $1
       ORDER BY (estado = 'activo') DESC, fecha_inicio DESC NULLS LAST, id DESC LIMIT 1`,
      [id],
    );
    return {
      filas: 1,
      colaborador: limpiar(ficha),
      contrato: contrato ? limpiar(contrato) : null,
    };
  }

  private async ausenciasColaborador(id: number): Promise<ResultadoHerramienta> {
    if (id <= 0) return { error: 'colaborador_id inválido. Usa buscar_colaborador primero.' };
    const [permisos, saldos, disfrutes, incapacidades] = await Promise.all([
      this.q(
        `SELECT tipo_permiso, fecha_solicitud, fecha_inicio, fecha_fin, horas, estado, justificacion, observacion_respuesta
         FROM permisos WHERE user_id = $1 ORDER BY fecha_inicio DESC NULLS LAST, id DESC LIMIT 20`,
        [id],
      ),
      this.q(
        `SELECT periodo, dias_totales, dias_tomados, dias_pendientes, estado
         FROM vacaciones WHERE user_id = $1 ORDER BY periodo DESC LIMIT 20`,
        [id],
      ),
      this.q(
        `SELECT fecha_inicio, fecha_fin, dias, estado, observacion
         FROM vacaciones_detalle WHERE user_id = $1 ORDER BY fecha_inicio DESC NULLS LAST, id DESC LIMIT 20`,
        [id],
      ),
      this.q(
        `SELECT tipo, fecha_inicio, fecha_fin, dias, entidad_emisora, numero_incapacidad, estado
         FROM incapacidades WHERE user_id = $1 ORDER BY fecha_inicio DESC NULLS LAST, id DESC LIMIT 20`,
        [id],
      ),
    ]);
    return {
      filas: permisos.length + saldos.length + disfrutes.length + incapacidades.length,
      permisos: permisos.map(limpiar),
      vacaciones_saldo_por_periodo: saldos.map(limpiar),
      vacaciones_disfrutes: disfrutes.map(limpiar),
      incapacidades: incapacidades.map(limpiar),
    };
  }

  private async asistenciaColaborador(id: number, desde: string, hasta: string): Promise<ResultadoHerramienta> {
    if (id <= 0) return { error: 'colaborador_id inválido. Usa buscar_colaborador primero.' };
    const hoy = this.clock.now();
    const fin = esFecha(hasta) ? hasta : toIsoDate(hoy);
    const inicio = esFecha(desde)
      ? desde
      : toIsoDate(new Date(new Date(`${fin}T12:00:00`).getTime() - 30 * 86_400_000));
    const filas = await this.q(
      `SELECT fecha, hora_entrada, hora_salida, minutos_tarde, minutos_salida_temprana, estado, justificacion
       FROM asistencia_resumen_diario
       WHERE user_id = $1 AND fecha BETWEEN $2 AND $3
       ORDER BY fecha DESC LIMIT 50`,
      [id, inicio, fin],
    );
    const [resumen] = await this.q(
      `SELECT COUNT(*)::int AS dias, COALESCE(SUM(minutos_tarde), 0)::int AS minutos_tarde,
              COUNT(*) FILTER (WHERE estado IN ('tarde', 'tarde_salida_temprana'))::int AS llegadas_tarde,
              COUNT(*) FILTER (WHERE estado = 'falla')::int AS fallas
       FROM asistencia_resumen_diario WHERE user_id = $1 AND fecha BETWEEN $2 AND $3`,
      [id, inicio, fin],
    );
    return { filas: filas.length, desde: inicio, hasta: fin, resumen: resumen ?? null, dias: filas.map(limpiar) };
  }

  private async contratosPorVencer(dias: number): Promise<ResultadoHerramienta> {
    const ventana = Math.min(365, dias > 0 ? dias : 30);
    const hoy = this.clock.today();
    const filas = await this.q(
      `SELECT c.id AS colaborador_id, c.nombre_completo, c.cedula, c.cargo, c.area, c.sede,
              ct.tipo_contrato, ct.numero_contrato, ct.fecha_inicio, ct.fecha_fin,
              (ct.fecha_fin - $1::date) AS dias_restantes
       FROM contratos ct JOIN colaboradores c ON c.id = ct.user_id
       WHERE ct.estado = 'activo' AND ct.fecha_fin IS NOT NULL
         AND ct.fecha_fin BETWEEN $1::date AND ($1::date + $2::int)
       ORDER BY ct.fecha_fin, c.nombre_completo LIMIT 50`,
      [hoy, ventana],
    );
    return { filas: filas.length, hoy, ventana_dias: ventana, contratos: filas.map(limpiar) };
  }

  /** Todas las tablas y vistas reales del esquema público (cacheado 1 h): refuerza la lista blanca. */
  private async tablasDeLaBase(): Promise<string[]> {
    const ahora = Date.now();
    if (this.cacheTablas && this.cacheTablas.expira > ahora) return this.cacheTablas.nombres;
    const filas = await this.q<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const nombres = filas.map((f) => f.table_name);
    this.cacheTablas = { nombres, expira: ahora + TTL_ESQUEMA_MS };
    return nombres;
  }

  /** Capas 2 y 3 del sandbox: transacción READ ONLY con statement_timeout y LIMIT forzado. */
  private async consultaSql(sql: string): Promise<ResultadoHerramienta> {
    const v = this.validador.validar(sql, await this.tablasDeLaBase());
    if (!v.ok) return { error: v.error };
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query(`SET LOCAL statement_timeout = ${TIMEOUT_SENTENCIA_MS}`);
      const filas = (await runner.query(this.validador.envolver(v.sql))) as Fila[];
      const truncado = filas.length > MAX_FILAS;
      const datos = (truncado ? filas.slice(0, MAX_FILAS) : filas).map(limpiar);
      return { filas: datos.length, truncado, datos };
    } catch (e) {
      return { error: `La consulta falló: ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      try {
        await runner.rollbackTransaction();
      } catch {
        /* la transacción pudo no haber iniciado */
      }
      await runner.release();
    }
  }
}

// ── Coerción de argumentos (el modelo no siempre respeta los tipos) ──

function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}
function i(v: unknown): number {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function esFecha(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime());
}
/** Fechas a texto ISO y textos largos recortados a 300 caracteres. */
function limpiar(fila: Fila): Fila {
  const out: Fila = {};
  for (const [k, v] of Object.entries(fila)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = typeof v === 'string' && v.length > MAX_TEXTO ? `${v.slice(0, MAX_TEXTO)}…` : v;
  }
  return out;
}
