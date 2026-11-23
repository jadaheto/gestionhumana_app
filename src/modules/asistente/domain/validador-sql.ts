/**
 * Capa 1 del sandbox de `consulta_sql`: un solo SELECT/WITH, sin palabras de
 * escritura ni del motor, y únicamente sobre la lista blanca de tablas.
 * Las capas 2 y 3 (transacción READ ONLY con statement_timeout y LIMIT forzado)
 * viven en el ejecutor de herramientas.
 */

/**
 * Tablas (y la vista `colaboradores`) que el asistente puede consultar con SQL libre.
 * `colaboradores` es una vista sobre `users` SIN contraseña, preferencias ni datos de acceso.
 * Quedan fuera a propósito: cuentas bancarias, desprendibles de nómina, endeudamiento,
 * familiares, chat y correo interno.
 */
export const TABLAS_PERMITIDAS: readonly string[] = [
  'colaboradores',
  'sedes',
  'areas',
  'cargos',
  'organigrama',
  'contratos',
  'contrato_prorrogas',
  'permisos',
  'vacaciones',
  'vacaciones_detalle',
  'incapacidades',
  'asistencia_resumen_diario',
  'puntos',
  'puntos_transacciones',
  'recompensas',
  'canjes',
  'comunicados',
  'certificados',
  'educacion_formal',
  'educacion_no_formal',
  'experiencia_laboral',
] as const;

export const MAX_FILAS = 200;

const PALABRAS_PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|reindex|cluster|comment|lock|listen|notify|prepare|execute|deallocate|call|do|set|reset|show|explain|into|pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|xp_)\b/i;

/** Tablas sensibles o del motor: se rechazan aunque alguien amplíe la lista blanca. */
const TABLAS_PROHIBIDAS =
  /\b(users|usuarios|api_keys|password_resets|login_history|app_settings|assistant_messages|cuentas_bancarias|chat_messages|emails|migrations|typeorm_migrations|information_schema|pg_catalog|pg_[a-z_]+)\b/i;

const CTE = /(?:\bwith\s+(?:recursive\s+)?|,\s*)([a-z_][a-z0-9_]*)\s*(?:\([^)]*\))?\s+as\s*\(/gi;
const REFERENCIA = /\b(?:from|join)\s+("?[a-z_][a-z0-9_]*"?(?:\s*\.\s*"?[a-z_][a-z0-9_]*"?)?)/gi;

export type ValidacionSql = { ok: true; sql: string } | { ok: false; error: string };

export class ValidadorSqlSoloLectura {
  constructor(private readonly tablasPermitidas: readonly string[] = TABLAS_PERMITIDAS) {}

  get tablas(): readonly string[] {
    return this.tablasPermitidas;
  }

  /**
   * @param otrasTablas nombres de TODAS las tablas reales de la base (opcional). Cualquiera que no esté en la
   * lista blanca se rechaza aunque aparezca fuera de un FROM/JOIN explícito (p. ej. `FROM a, b`).
   */
  validar(entrada: string, otrasTablas: readonly string[] = []): ValidacionSql {
    const sql = (entrada ?? '').trim().replace(/[;\s]+$/u, '');
    if (!sql) return { ok: false, error: 'Consulta vacía.' };
    if (sql.includes(';')) return { ok: false, error: 'Solo se permite una sentencia.' };
    if (!/^\s*(select|with)\b/i.test(sql)) return { ok: false, error: 'Solo se permiten consultas SELECT.' };
    const palabra = PALABRAS_PROHIBIDAS.exec(sql);
    if (palabra) return { ok: false, error: `Palabra no permitida en la consulta: ${palabra[1].toLowerCase()}.` };
    const tabla = TABLAS_PROHIBIDAS.exec(sql);
    if (tabla) return { ok: false, error: `Tabla no permitida: ${tabla[1].toLowerCase()}.` };

    for (const otra of otrasTablas) {
      const nombre = otra.toLowerCase();
      if (this.tablasPermitidas.includes(nombre) || !/^[a-z_][a-z0-9_]*$/.test(nombre)) continue;
      if (new RegExp(`\\b${nombre}\\b`, 'i').test(sql))
        return { ok: false, error: `Tabla fuera de la lista permitida: ${nombre}.` };
    }

    const ctes = new Set<string>();
    for (const m of sql.matchAll(CTE)) ctes.add(m[1].toLowerCase());
    for (const m of sql.matchAll(REFERENCIA)) {
      const ref = m[1].replace(/"/g, '').replace(/\s+/g, '').toLowerCase();
      const partes = ref.split('.');
      const nombre = partes[partes.length - 1];
      if (ctes.has(nombre)) continue;
      if (partes.length > 1 && partes[0] !== 'public')
        return { ok: false, error: `Esquema no permitido: ${partes[0]}.` };
      if (!this.tablasPermitidas.includes(nombre))
        return { ok: false, error: `Tabla fuera de la lista permitida: ${nombre}.` };
    }
    return { ok: true, sql };
  }

  /** Envoltura con LIMIT forzado (una fila extra para detectar truncado). */
  envolver(sql: string, maxFilas = MAX_FILAS): string {
    return `SELECT * FROM (${sql}) AS asistente_q LIMIT ${maxFilas + 1}`;
  }
}
