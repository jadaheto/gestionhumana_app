import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.es_colaborador`: marca a los administradores que además son empleados de la Caja,
 * para que aparezcan como colaboradores (listados, organigrama, conteos, contratos, asistencia).
 * Los funcionarios siempre cuentan como colaboradores; la marca sólo aplica al rol `admin`.
 */
export class AdminEsColaborador1796500000000 implements MigrationInterface {
  name = 'AdminEsColaborador1796500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS es_colaborador BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS es_colaborador`);
  }
}
