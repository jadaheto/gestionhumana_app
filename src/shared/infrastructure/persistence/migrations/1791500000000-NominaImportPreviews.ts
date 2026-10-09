import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla de vistas previas de importación de nómina (módulo `nomina`).
 * El legado guardaba esta información en `uploads/nomina/preview_<token>.json`;
 * persistirla en BD permite actualizaciones atómicas (lote asociado, avance)
 * y limpieza por antigüedad con SQL.
 */
export class NominaImportPreviews1791500000000 implements MigrationInterface {
  name = 'NominaImportPreviews1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nomina_import_previews (
        token VARCHAR(64) PRIMARY KEY,
        lote_id INT NULL REFERENCES nomina_import_lotes(id) ON DELETE SET NULL,
        archivo VARCHAR(255) NOT NULL,
        archivo_original VARCHAR(255) NULL,
        parsed JSONB NOT NULL,
        nuevos INT DEFAULT 0,
        existentes INT DEFAULT 0,
        lote_previo JSONB NULL,
        procesados INT DEFAULT 0,
        created_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_nomina_import_previews_lote ON nomina_import_previews(lote_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS nomina_import_previews`);
  }
}
