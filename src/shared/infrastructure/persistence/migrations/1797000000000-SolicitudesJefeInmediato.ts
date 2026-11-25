import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aprobación de solicitudes en dos pasos: jefe inmediato (según el organigrama) y luego Gestión Humana.
 * `jefe_estado`: no_aplica (sin jefe; va directo a Gestión Humana) | pendiente | aprobado | rechazado.
 * Las solicitudes existentes quedan en `no_aplica`, es decir, las sigue resolviendo Gestión Humana.
 */
export class SolicitudesJefeInmediato1797000000000 implements MigrationInterface {
  name = 'SolicitudesJefeInmediato1797000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE permisos ADD COLUMN IF NOT EXISTS jefe_id INT NULL`);
    await q.query(`ALTER TABLE permisos ADD COLUMN IF NOT EXISTS jefe_estado VARCHAR(20) NOT NULL DEFAULT 'no_aplica'`);
    await q.query(`ALTER TABLE permisos ADD COLUMN IF NOT EXISTS jefe_observacion TEXT NULL`);
    await q.query(`ALTER TABLE permisos ADD COLUMN IF NOT EXISTS jefe_fecha TIMESTAMP NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_permisos_jefe ON permisos(jefe_id, jefe_estado)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_permisos_jefe`);
    await q.query(`ALTER TABLE permisos DROP COLUMN IF EXISTS jefe_fecha`);
    await q.query(`ALTER TABLE permisos DROP COLUMN IF EXISTS jefe_observacion`);
    await q.query(`ALTER TABLE permisos DROP COLUMN IF EXISTS jefe_estado`);
    await q.query(`ALTER TABLE permisos DROP COLUMN IF EXISTS jefe_id`);
  }
}
