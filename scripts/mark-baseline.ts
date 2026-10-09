/**
 * Marca la migración base como aplicada SIN ejecutarla.
 * Úsalo cuando la base de datos proviene del sistema legado (ya tiene el esquema).
 *   npm run migration:baseline
 */
import dataSource from '../src/shared/infrastructure/persistence/typeorm.config';

async function main() {
  await dataSource.initialize();
  await dataSource.query(`CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, timestamp BIGINT NOT NULL, name VARCHAR NOT NULL)`);
  const exists = await dataSource.query(`SELECT 1 FROM migrations WHERE name = $1`, ['BaselineSchema1700000000000']);
  if (exists.length === 0) {
    await dataSource.query(`INSERT INTO migrations (timestamp, name) VALUES ($1, $2)`, [1700000000000, 'BaselineSchema1700000000000']);
    console.log('Migración base marcada como aplicada.');
  } else {
    console.log('La migración base ya estaba marcada.');
  }
  await dataSource.destroy();
}
void main();
