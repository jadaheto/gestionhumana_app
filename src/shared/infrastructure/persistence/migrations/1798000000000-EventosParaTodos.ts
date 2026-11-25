import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Eventos para todos los trabajadores:
 * - `calendar_events.para_todos`: evento institucional visible para todos.
 * - `users.puede_crear_eventos`: persona designada por Gestión Humana para crearlos (los administradores siempre pueden).
 */
export class EventosParaTodos1798000000000 implements MigrationInterface {
  name = 'EventosParaTodos1798000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS para_todos BOOLEAN NOT NULL DEFAULT FALSE`);
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS puede_crear_eventos BOOLEAN NOT NULL DEFAULT FALSE`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_calendar_events_para_todos ON calendar_events(start_date) WHERE para_todos`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_calendar_events_para_todos`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS puede_crear_eventos`);
    await q.query(`ALTER TABLE calendar_events DROP COLUMN IF EXISTS para_todos`);
  }
}
