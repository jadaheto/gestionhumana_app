import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración base: crea el esquema completo heredado del sistema CodeIgniter
 * (`database/001_schema_base.sql`) más el DDL que aquel sistema ejecutaba en
 * tiempo de ejecución (`database/002_schema_runtime.sql`).
 *
 * Si la base de datos ya existe (migración desde el sistema legado), ejecuta
 * `npm run migration:baseline` para marcar esta migración como aplicada sin
 * ejecutarla.
 */
export class BaselineSchema1700000000000 implements MigrationInterface {
  name = 'BaselineSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const root = path.resolve(__dirname, '../../../../../database');
    for (const file of ['001_schema_base.sql', '002_schema_runtime.sql']) {
      const sql = readFileSync(path.join(root, file), 'utf8');
      await queryRunner.query(sql);
    }
  }

  public down(): Promise<void> {
    return Promise.reject(new Error('La migración base no es reversible. Elimina la base de datos manualmente.'));
  }
}
