/**
 * Configuración tipada de la aplicación, derivada de las variables de entorno.
 * Se registra con `ConfigModule.forRoot({ load: [configuration] })` y se
 * consume con `ConfigService<AppConfig, true>`.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  frontendUrl: string;
  uploadsDir: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    pass: string;
    ssl: boolean;
    migrationsRun: boolean;
    synchronize: boolean;
  };
  jwt: { secret: string; expiresIn: string };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  };
  comunicados: { mailMode: 'test' | 'produccion'; testTo: string; prodTo: string };
  /** Ingreso con Google (OAuth 2.0). Solo entran correos ya registrados en `users`. */
  google: {
    clientId: string;
    clientSecret: string;
    /** URL de retorno registrada en Google Cloud (debe llegar al API). */
    callbackUrl: string;
    /** Dominio de Google Workspace permitido (vacío = cualquier cuenta registrada). */
    workspaceDomain: string;
  };
  /** Asistente IA "Ask AI": proveedor compatible con OpenAI (DeepSeek). Sin clave el asistente responde 503. */
  asistente: { apiKey: string; model: string; baseUrl: string; timeoutMs: number };
  /**
   * Base de datos externa del reloj biométrico (PostgreSQL) con la estructura del reporte
   * "Asistencia Diaria". Con `host` vacío queda apagada y la asistencia sólo se carga por archivo.
   */
  asistenciaDb: {
    host: string;
    port: number;
    name: string;
    user: string;
    pass: string;
    ssl: boolean;
    schema: string;
    /** Tabla o vista con las marcaciones. */
    table: string;
    /** Columna con la fecha y hora de la marcación. */
    fechaColumn: string;
    timeoutMs: number;
  };
}

export default (): AppConfig => ({
  env: (process.env.NODE_ENV as AppConfig['env']) ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  uploadsDir: process.env.UPLOADS_DIR ?? './uploads',
  database: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    name: process.env.DB_NAME ?? 'gestion_humana',
    user: process.env.DB_USER ?? 'postgres',
    pass: process.env.DB_PASS ?? '',
    ssl: process.env.DB_SSL === 'true',
    migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me-please',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    fromEmail: process.env.MAIL_FROM_EMAIL ?? 'noreply@comfasucre.com.co',
    fromName: process.env.MAIL_FROM_NAME ?? 'Comfasucre Admin',
  },
  comunicados: {
    mailMode: (process.env.COMUNICADOS_MAIL_MODE as 'test' | 'produccion') ?? 'test',
    testTo: process.env.COMUNICADOS_MAIL_TEST_TO ?? '',
    prodTo: process.env.COMUNICADOS_MAIL_PROD_TO ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
    workspaceDomain: (process.env.GOOGLE_WORKSPACE_DOMAIN ?? '').trim().toLowerCase(),
  },
  asistente: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 30000),
  },
  asistenciaDb: {
    host: (process.env.ASISTENCIA_DB_HOST ?? '').trim(),
    port: Number(process.env.ASISTENCIA_DB_PORT ?? 5432),
    name: process.env.ASISTENCIA_DB_NAME ?? '',
    user: process.env.ASISTENCIA_DB_USER ?? '',
    pass: process.env.ASISTENCIA_DB_PASSWORD ?? '',
    ssl: process.env.ASISTENCIA_DB_SSL === 'true',
    schema: (process.env.ASISTENCIA_DB_SCHEMA ?? 'public').trim() || 'public',
    table: (process.env.ASISTENCIA_DB_TABLE ?? 'asistencia_diaria').trim() || 'asistencia_diaria',
    fechaColumn: (process.env.ASISTENCIA_DB_COLUMNA_FECHA ?? 'fecha_hora').trim() || 'fecha_hora',
    timeoutMs: Number(process.env.ASISTENCIA_DB_TIMEOUT_MS ?? 8000),
  },
});
