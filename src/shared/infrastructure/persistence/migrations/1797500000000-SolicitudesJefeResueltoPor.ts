import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `permisos.jefe_resuelto_por`: quién registró la respuesta del jefe inmediato. Permite distinguir
 * el visto bueno que un administrador da en nombre del jefe (distinto de `jefe_id`).
 */
export class SolicitudesJefeResueltoPor1797500000000 implements MigrationInterface {
  name = 'SolicitudesJefeResueltoPor1797500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE permisos ADD COLUMN IF NOT EXISTS jefe_resuelto_por INT NULL`);
    await q.query(
      `UPDATE permisos SET jefe_resuelto_por = jefe_id
        WHERE jefe_resuelto_por IS NULL AND jefe_estado IN ('aprobado', 'rechazado')`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE permisos DROP COLUMN IF EXISTS jefe_resuelto_por`);
  }
}
