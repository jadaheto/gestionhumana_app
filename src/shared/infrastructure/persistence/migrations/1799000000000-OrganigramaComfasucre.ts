import { MigrationInterface, QueryRunner } from 'typeorm';

type Tipo = 'linea' | 'asesora' | 'control' | 'comite';
/** [nombre, dependencia de la que cuelga (null = raíz), posición entre hermanas, tipo]. */
type Dependencia = [nombre: string, padre: string | null, orden: number, tipo: Tipo];

const ASAMBLEA = 'Asamblea General de Afiliados';
const CONSEJO = 'Consejo Directivo';
const DIRECCION = 'Dirección Administrativa';
const SOCIALES = 'Servicios Sociales';
const FINANCIERA = 'Financiera y Administrativa';
const JURIDICA = 'Jurídica y Contratación';
const COMERCIAL = 'Comercial y Mercadeo';
const GESTION_HUMANA = 'Gestión Humana';

/** Nombres que cambian respecto al organigrama anterior: [anterior, actual]. */
const RENOMBRES: Array<[string, string]> = [
  ['Jurídica y Representacion Judicial', JURIDICA],
  ['Planeación, Calidad y Desarrollo Institucional', 'Planeación, Calidad y Desarrollo'],
  ['Auditoria y Gestion del Riesgo', 'Auditoría Interna'],
  ['Mercadeo Corporativo, Comercial y Turismo', COMERCIAL],
  ['Servicio al Cliente y Comunicaciones', 'Servicio al Cliente'],
  ['Subsidio y Aportes', 'Aportes y Subsidio'],
  ['Crédito Social', 'Crédito y Cartera'],
];

/** Organigrama oficial de Comfasucre. Los padres van siempre antes que sus hijas. */
const ORGANIGRAMA: Dependencia[] = [
  [ASAMBLEA, null, 0, 'linea'],
  ['Revisoría Fiscal', ASAMBLEA, 0, 'control'],
  [CONSEJO, ASAMBLEA, 1, 'linea'],
  ['Comité de Auditoría, Riesgo y Cumplimiento', CONSEJO, 0, 'comite'],
  ['Comité de Negocios Estratégicos', CONSEJO, 1, 'comite'],
  ['Comité de Buen Gobierno y Ética', CONSEJO, 2, 'comite'],
  [DIRECCION, CONSEJO, 3, 'linea'],
  ['Comité de Gestión Humana', DIRECCION, 0, 'comite'],
  ['Comité Financiero', DIRECCION, 1, 'comite'],
  ['Comité de Control de Gestión', DIRECCION, 2, 'comite'],
  ['Comité de Archivo Central', DIRECCION, 3, 'comite'],
  ['Comité de Gestión de Calidad', DIRECCION, 4, 'comite'],
  ['Comité de Ética', DIRECCION, 5, 'comite'],
  ['Planeación, Calidad y Desarrollo', DIRECCION, 10, 'asesora'],
  ['Auditoría Interna', DIRECCION, 11, 'asesora'],
  [JURIDICA, DIRECCION, 12, 'asesora'],
  [GESTION_HUMANA, DIRECCION, 13, 'asesora'],
  ['SG-SST', GESTION_HUMANA, 0, 'linea'],
  ['Oficial de Transparencia y Ética Empresarial', DIRECCION, 14, 'asesora'],
  ['Oficial de Seguridad de la Información', DIRECCION, 15, 'asesora'],
  [COMERCIAL, DIRECCION, 16, 'asesora'],
  ['Servicio al Cliente', COMERCIAL, 0, 'linea'],
  ['Comunicaciones Corporativas', COMERCIAL, 1, 'linea'],
  ['Turismo Social', DIRECCION, 20, 'linea'],
  [SOCIALES, DIRECCION, 21, 'linea'],
  ['Vivienda', SOCIALES, 0, 'linea'],
  ['Infraestructura', SOCIALES, 1, 'linea'],
  ['FOSFEC', SOCIALES, 2, 'linea'],
  ['Biblioteca, Cultura y Discapacidad', SOCIALES, 3, 'linea'],
  ['Recreación', SOCIALES, 4, 'linea'],
  ['FONIÑEZ', SOCIALES, 5, 'linea'],
  ['Educación', SOCIALES, 6, 'linea'],
  ['INTECOMFA', SOCIALES, 7, 'linea'],
  ['Deporte', SOCIALES, 8, 'linea'],
  [FINANCIERA, DIRECCION, 22, 'linea'],
  ['Contabilidad', FINANCIERA, 0, 'linea'],
  ['Aportes y Subsidio', FINANCIERA, 1, 'linea'],
  ['Tesorería', FINANCIERA, 2, 'linea'],
  ['Servicios Generales', FINANCIERA, 3, 'linea'],
  ['Gestión Documental', FINANCIERA, 4, 'linea'],
  ['Crédito y Cartera', FINANCIERA, 5, 'linea'],
  ["TIC'S", DIRECCION, 23, 'linea'],
];

/**
 * Dependencias del organigrama anterior que ya no figuran: [nombre, dónde quedan si aún
 * tienen colaboradores o cargos]. Si están vacías se inactivan.
 */
const RETIRADAS: Array<[string, string]> = [
  ['Contratación', JURIDICA],
  ['Bienestar', SOCIALES],
  ...RENOMBRES.map(([anterior, actual]): [string, string] => [anterior, actual]),
];

/** Compara nombres sin distinguir mayúsculas ni tildes ("EDUCACION" = "Educación"). */
const CLAVE = (expr: string): string => `LOWER(TRANSLATE(TRIM(${expr}), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))`;

/**
 * Deja el organigrama de dependencias como el oficial de Comfasucre: órgano de control,
 * comités, oficinas asesoras de la Dirección y las cuatro áreas de línea. Añade `areas.tipo`.
 * Las áreas existentes se reutilizan por nombre (conservan id, responsable, cargos y
 * colaboradores); nunca se borra ninguna.
 */
export class OrganigramaComfasucre1799000000000 implements MigrationInterface {
  name = 'OrganigramaComfasucre1799000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE areas ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'linea'`);

    const buscar = async (nombre: string): Promise<number | null> => {
      const filas = (await q.query(
        `SELECT id FROM areas WHERE ${CLAVE('nombre')} = ${CLAVE('$1')} ORDER BY id LIMIT 1`,
        [nombre],
      )) as Array<{ id: number }>;
      return filas[0] ? Number(filas[0].id) : null;
    };

    // Un área sólo se renombra si la del nombre nuevo no existe ya (si existe, la anterior pasa a "retirada").
    for (const [anterior, actual] of RENOMBRES) {
      const id = await buscar(anterior);
      if (id !== null && (await buscar(actual)) === null) {
        await q.query(`UPDATE areas SET nombre = $1 WHERE id = $2`, [actual, id]);
      }
    }

    const ids = new Map<string, number>();
    for (const [nombre, padre, orden, tipo] of ORGANIGRAMA) {
      const padreId = padre === null ? null : (ids.get(padre) ?? null);
      let id = await buscar(nombre);
      if (id === null) {
        const creadas = (await q.query(
          `INSERT INTO areas (nombre, padre_id, orden, tipo, estado) VALUES ($1, $2, $3, $4, 'activo') RETURNING id`,
          [nombre, padreId, orden, tipo],
        )) as Array<{ id: number }>;
        id = Number(creadas[0].id);
      } else {
        await q.query(
          `UPDATE areas SET nombre = $1, padre_id = $2, orden = $3, tipo = $4, estado = 'activo' WHERE id = $5`,
          [nombre, padreId, orden, tipo, id],
        );
      }
      ids.set(nombre, id);
    }

    for (const [nombre, destino] of RETIRADAS) {
      const id = await buscar(nombre);
      if (id === null || [...ids.values()].includes(id)) continue;
      const uso = (await q.query(
        `SELECT (SELECT COUNT(*) FROM users WHERE area_id = $1) + (SELECT COUNT(*) FROM cargos WHERE area_id = $1) AS total`,
        [id],
      )) as Array<{ total: string | number }>;
      if (Number(uso[0].total) === 0) {
        await q.query(`UPDATE areas SET estado = 'inactivo', padre_id = NULL WHERE id = $1`, [id]);
      } else {
        await q.query(`UPDATE areas SET padre_id = $1, orden = 99, tipo = 'linea' WHERE id = $2`, [
          ids.get(destino) ?? null,
          id,
        ]);
      }
    }
  }

  /** Sólo quita el tipo: la estructura anterior no se puede reconstruir (se edita en Configuración → Áreas). */
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE areas DROP COLUMN IF EXISTS tipo`);
  }
}
