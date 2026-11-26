import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { AppConfig } from '../../../../config/configuration';
import { MarcacionImportada } from '../../domain/marcacion';
import { mapearFilaMarcacion } from '../../domain/marcacion-row.mapper';
import { MarcacionesExternasReader } from '../../domain/ports';

/** Identificador SQL entre comillas dobles (admite nombres como `Fecha/Hora`). */
export function identificadorSql(nombre: string): string {
  return `"${nombre.replace(/"/g, '""')}"`;
}

/** Valor de una celda como texto; las fechas quedan `YYYY-MM-DD HH:mm:ss` en hora local. */
export function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${valor.getFullYear()}-${p(valor.getMonth() + 1)}-${p(valor.getDate())} ` +
      `${p(valor.getHours())}:${p(valor.getMinutes())}:${p(valor.getSeconds())}`
    );
  }
  return String(valor).trim();
}

/** Convierte filas de la tabla externa en marcaciones, con las mismas reglas que el archivo del reloj. */
export function filasAMarcaciones(filas: Array<Record<string, unknown>>): MarcacionImportada[] {
  const marcaciones: MarcacionImportada[] = [];
  for (const fila of filas) {
    const columnas = Object.keys(fila);
    const m = mapearFilaMarcacion(
      columnas.map((c) => celdaATexto(fila[c])),
      columnas,
    );
    if (m) marcaciones.push(m);
  }
  return marcaciones;
}

/**
 * Lee las marcaciones de la base externa del reloj (PostgreSQL). La tabla tiene
 * las columnas del reporte "Asistencia Diaria"; los nombres se reconocen sin
 * importar mayúsculas, tildes o separadores (`ID de usuario` = `id_de_usuario`).
 * La conexión es propia y de sólo lectura: nunca escribe en esa base.
 */
@Injectable()
export class PgMarcacionesExternasReader extends MarcacionesExternasReader implements OnModuleDestroy {
  private readonly cfg: AppConfig['asistenciaDb'];
  private pool: Pool | null = null;

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    this.cfg = config.get('asistenciaDb', { infer: true });
  }

  habilitado(): boolean {
    return this.cfg.host !== '';
  }

  async leerDia(fecha: string): Promise<MarcacionImportada[]> {
    const col = identificadorSql(this.cfg.fechaColumn);
    const tabla = `${identificadorSql(this.cfg.schema)}.${identificadorSql(this.cfg.table)}`;
    // La columna puede ser TIMESTAMP o texto `YYYY-MM-DD HH:mm:ss`: se compara como texto.
    const { rows } = await this.conexion().query<Record<string, unknown>>(
      `SELECT * FROM ${tabla}
        WHERE CAST(${col} AS text) >= $1 AND CAST(${col} AS text) < $2
        ORDER BY ${col} ASC`,
      [`${fecha} 00:00:00`, `${fecha} 24`],
    );
    return filasAMarcaciones(rows);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end().catch(() => undefined);
  }

  private conexion(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        host: this.cfg.host,
        port: this.cfg.port,
        database: this.cfg.name,
        user: this.cfg.user,
        password: this.cfg.pass,
        ssl: this.cfg.ssl ? { rejectUnauthorized: false } : undefined,
        max: 2,
        connectionTimeoutMillis: this.cfg.timeoutMs,
        statement_timeout: this.cfg.timeoutMs,
        application_name: 'gestion-humana-asistencia',
      });
      // Un fallo de una conexión inactiva no debe tumbar el proceso.
      this.pool.on('error', () => undefined);
    }
    return this.pool;
  }
}
