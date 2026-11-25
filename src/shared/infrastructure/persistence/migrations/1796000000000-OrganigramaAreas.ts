import { MigrationInterface, QueryRunner } from 'typeorm';

/** [nombre, dependencia de la que cuelga (null = raíz), posición entre hermanas]. */
type Dependencia = [nombre: string, padre: string | null, orden: number];

/**
 * Organigrama de dependencias de Comfasucre (el mismo que maneja VIGÍA SSF).
 * Los padres van siempre antes que sus hijas.
 */
const ORGANIGRAMA: Dependencia[] = [
  ['Asamblea General de Afiliados', null, 0],
  ['Consejo Directivo', 'Asamblea General de Afiliados', 0],
  ['Dirección Administrativa', 'Consejo Directivo', 0],
  ['Revisoría Fiscal', 'Consejo Directivo', 1],
  ['Contratación', 'Dirección Administrativa', 0],
  ['Financiera y Administrativa', 'Dirección Administrativa', 1],
  ['Gestion Humana', 'Dirección Administrativa', 2],
  ['Jurídica y Representacion Judicial', 'Dirección Administrativa', 3],
  ['Planeación, Calidad y Desarrollo Institucional', 'Dirección Administrativa', 4],
  ['Servicio al Cliente y Comunicaciones', 'Dirección Administrativa', 5],
  ['Servicios Sociales', 'Dirección Administrativa', 6],
  ["TIC'S", 'Dirección Administrativa', 7],
  ['Contabilidad', 'Financiera y Administrativa', 0],
  ['Crédito Social', 'Financiera y Administrativa', 1],
  ['Tesoreria', 'Financiera y Administrativa', 2],
  ['FOSFEC', 'Servicios Sociales', 0],
  ['Foniñez', 'Servicios Sociales', 1],
  ['Infraestructura', 'Servicios Sociales', 2],
  ['Subsidio y Aportes', 'Servicios Sociales', 3],
  ['Vivienda', 'Servicios Sociales', 4],
  ['Auditoria y Gestion del Riesgo', null, 1],
  ['Bienestar', null, 2],
  ['Educación', null, 3],
  ['Gestion Documental', null, 4],
  ['Mercadeo Corporativo, Comercial y Turismo', null, 5],
  ['SG-SST', null, 6],
  ['Servicios Generales', null, 7],
];

/** Compara nombres sin distinguir mayúsculas ni tildes ("EDUCACION" = "Educación"). */
const CLAVE = (expr: string): string => `LOWER(TRANSLATE(TRIM(${expr}), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))`;

/**
 * Jerarquía entre áreas (`padre_id`, `orden`) y carga del organigrama de dependencias.
 * Las áreas que ya existen (mismo nombre) se reutilizan; sólo se enlazan las que aún
 * no tienen dependencia superior, para no pisar cambios hechos a mano.
 */
export class OrganigramaAreas1796000000000 implements MigrationInterface {
  name = 'OrganigramaAreas1796000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE areas ADD COLUMN IF NOT EXISTS padre_id INT NULL`);
    await q.query(`ALTER TABLE areas ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 0`);
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_areas_padre') THEN
          ALTER TABLE areas ADD CONSTRAINT fk_areas_padre
            FOREIGN KEY (padre_id) REFERENCES areas(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_areas_padre ON areas(padre_id)`);

    const ids = new Map<string, number>();
    for (const [nombre, padre, orden] of ORGANIGRAMA) {
      const existentes = (await q.query(
        `SELECT id, padre_id FROM areas WHERE ${CLAVE('nombre')} = ${CLAVE('$1')} ORDER BY id LIMIT 1`,
        [nombre],
      )) as Array<{ id: number; padre_id: number | null }>;
      const padreId = padre === null ? null : (ids.get(padre) ?? null);
      if (existentes[0]) {
        const id = Number(existentes[0].id);
        ids.set(nombre, id);
        if (existentes[0].padre_id === null && padreId !== id) {
          await q.query(`UPDATE areas SET padre_id = $1, orden = $2 WHERE id = $3`, [padreId, orden, id]);
        }
        continue;
      }
      const creadas = (await q.query(
        `INSERT INTO areas (nombre, padre_id, orden, estado) VALUES ($1, $2, $3, 'activo') RETURNING id`,
        [nombre, padreId, orden],
      )) as Array<{ id: number }>;
      ids.set(nombre, Number(creadas[0].id));
    }
  }

  /** Quita la jerarquía; las áreas creadas se conservan (pueden tener cargos y colaboradores). */
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_areas_padre`);
    await q.query(`ALTER TABLE areas DROP CONSTRAINT IF EXISTS fk_areas_padre`);
    await q.query(`ALTER TABLE areas DROP COLUMN IF EXISTS orden`);
    await q.query(`ALTER TABLE areas DROP COLUMN IF EXISTS padre_id`);
  }
}
