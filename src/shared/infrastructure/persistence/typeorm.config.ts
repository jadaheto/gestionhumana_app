import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AppConfig } from '../../../config/configuration';

export function buildTypeOrmOptions(config: ConfigService<AppConfig, true>): TypeOrmModuleOptions {
  const db = config.get('database', { infer: true });
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    database: db.name,
    username: db.user,
    password: db.pass,
    ssl: db.ssl ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    // El esquema se gestiona con migraciones explícitas, nunca con synchronize.
    synchronize: false,
    logging: config.get('env', { infer: true }) === 'development' ? ['error', 'warn'] : ['error'],
  };
}

/** DataSource usado por la CLI de TypeORM (`npm run migration:*`). */
export const cliDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'gestion_humana',
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/../../../**/*.orm-entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
};

export default new DataSource(cliDataSourceOptions);
