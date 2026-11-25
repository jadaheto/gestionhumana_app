import { MigrationInterface, QueryRunner } from 'typeorm';

/** `users.lugar_expedicion_cedula`: municipio y departamento donde se expidió la cédula (certificado laboral). */
export class LugarExpedicionCedula1798500000000 implements MigrationInterface {
  name = 'LugarExpedicionCedula1798500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lugar_expedicion_cedula VARCHAR(120)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS lugar_expedicion_cedula`);
  }
}
