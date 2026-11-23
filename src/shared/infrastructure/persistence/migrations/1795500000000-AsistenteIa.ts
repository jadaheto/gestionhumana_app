import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asistente IA "Ask AI" (módulo `asistente`):
 * - `assistant_messages`: auditoría de cada pregunta (usuario, respuesta, SQL generado, herramientas, tokens).
 * - Vista `colaboradores`: proyección de `users` SIN contraseña, preferencias ni datos de acceso, con los
 *   nombres de sede, área y cargo. Es lo único que el asistente puede leer de las personas.
 */
export class AsistenteIa1795500000000 implements MigrationInterface {
  name = 'AsistenteIa1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id SERIAL PRIMARY KEY,
        user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
        conversation_key VARCHAR(64) NULL,
        question TEXT NOT NULL,
        answer TEXT NULL,
        sql_generated TEXT NULL,
        tool_calls JSONB NULL,
        model VARCHAR(60) NULL,
        prompt_tokens INT NULL,
        completion_tokens INT NULL,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        error TEXT NULL,
        duration_ms INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assistant_messages_user ON assistant_messages(user_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_key)`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE VIEW colaboradores AS
      SELECT u.id,
             u.first_name, u.last_name,
             TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS nombre_completo,
             u.email, u.cedula, u.codigo_empresa, u.role, u.estado_colaborador,
             u.sede_id, s.nombre AS sede,
             u.area_id, a.nombre AS area,
             u.cargo_id, c.nombre AS cargo,
             u.fecha_ingreso, u.fecha_nacimiento, u.genero, u.estado_civil,
             u.city AS ciudad, u.direccion, u.telefono, u.celular,
             u.eps, u.arl, u.fondo_pension, u.caja_compensacion, u.tipo_sangre, u.numero_hijos,
             u.created_at
      FROM users u
      LEFT JOIN sedes s ON s.id = u.sede_id
      LEFT JOIN areas a ON a.id = u.area_id
      LEFT JOIN cargos c ON c.id = u.cargo_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS colaboradores`);
    await queryRunner.query(`DROP TABLE IF EXISTS assistant_messages`);
  }
}
