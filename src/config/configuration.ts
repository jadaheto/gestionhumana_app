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
});
