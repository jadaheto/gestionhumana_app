import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const EMAIL = 'camilo.vides@comfasucre.com.co';

/**
 * Administrador que ingresa con Google. La contraseña local es aleatoria (nadie la conoce),
 * así que la cuenta solo puede entrar por el ingreso con Google.
 * Si el correo ya existe, lo promueve a administrador activo.
 */
export class AdminCamiloVides1792000000000 implements MigrationInterface {
  name = 'AdminCamiloVides1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = (await queryRunner.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [EMAIL])) as Array<{
      id: number;
    }>;
    if (existing.length) {
      await queryRunner.query(`UPDATE users SET role = 'admin', estado_colaborador = 'activo' WHERE id = $1`, [
        existing[0].id,
      ]);
      return;
    }
    const hash = await bcrypt.hash(randomBytes(24).toString('base64url'), 10);
    await queryRunner.query(
      `INSERT INTO users (username, email, password, first_name, last_name, role, estado_colaborador, fecha_ingreso)
       VALUES ('camilo.vides', $1, $2, 'Camilo', 'Vides', 'admin', 'activo', CURRENT_DATE)`,
      [EMAIL, hash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE LOWER(email) = $1`, [EMAIL]);
  }
}
