import { existsSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { AppSettingOrmEntity } from '../../../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import {
  CedulasExistentesReader,
  CertificadoConfig,
  CertificadoConfigReader,
  ContratoReader,
  ContratoResumen,
  PerfilColaborador,
  PerfilColaboradorReader,
  ProrrogaResumen,
} from '../../domain/ports';

/** Perfil del colaborador con cargo/área/sede (misma consulta que `MiPuesto_model::get_user_profile`). */
@Injectable()
export class TypeOrmPerfilColaboradorReader extends PerfilColaboradorReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async getPerfil(userId: number): Promise<PerfilColaborador | null> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.cedula, u.genero,
              c.nombre AS cargo_nombre, c.funciones AS cargo_funciones,
              a.nombre AS area_nombre, s.nombre AS sede_nombre
         FROM users u
         LEFT JOIN cargos c ON c.id = u.cargo_id
         LEFT JOIN areas a ON a.id = u.area_id
         LEFT JOIN sedes s ON s.id = u.sede_id
        WHERE u.id = $1
        LIMIT 1`,
      [userId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      firstName: String(r.first_name ?? ''),
      lastName: String(r.last_name ?? ''),
      cedula: r.cedula === null || r.cedula === undefined ? null : String(r.cedula),
      genero: (r.genero as string | null) ?? null,
      cargoNombre: (r.cargo_nombre as string | null) ?? null,
      cargoFunciones: (r.cargo_funciones as string | null) ?? null,
      areaNombre: (r.area_nombre as string | null) ?? null,
      sedeNombre: (r.sede_nombre as string | null) ?? null,
    };
  }
}

const toContrato = (r: Record<string, unknown>): ContratoResumen => ({
  id: Number(r.id),
  userId: Number(r.user_id),
  tipoContrato: String(r.tipo_contrato ?? ''),
  numeroContrato: String(r.numero_contrato ?? ''),
  fechaInicio: toIso(r.fecha_inicio) ?? '',
  fechaFin: toIso(r.fecha_fin),
  salarioBase: Number(r.salario_base ?? 0),
  estado: String(r.estado ?? ''),
});

function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

/** Lectura de `contratos` y `contrato_prorrogas` (contexto Contratos) con SQL parametrizado. */
@Injectable()
export class TypeOrmContratoReader extends ContratoReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async contratoActual(userId: number): Promise<ContratoResumen | null> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT id, user_id, tipo_contrato, numero_contrato, fecha_inicio::text, fecha_fin::text, salario_base, estado
         FROM contratos
        WHERE user_id = $1 AND estado = 'activo'
          AND fecha_inicio <= CURRENT_DATE
          AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
        ORDER BY fecha_inicio DESC
        LIMIT 1`,
      [userId],
    );
    return rows[0] ? toContrato(rows[0]) : null;
  }
  async contratosVencidos(userId: number): Promise<ContratoResumen[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT id, user_id, tipo_contrato, numero_contrato, fecha_inicio::text, fecha_fin::text, salario_base, estado
         FROM contratos
        WHERE user_id = $1 AND fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE
        ORDER BY fecha_fin DESC`,
      [userId],
    );
    return rows.map(toContrato);
  }
  async contratoDeUsuario(contratoId: number, userId: number): Promise<ContratoResumen | null> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT id, user_id, tipo_contrato, numero_contrato, fecha_inicio::text, fecha_fin::text, salario_base, estado
         FROM contratos WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [contratoId, userId],
    );
    return rows[0] ? toContrato(rows[0]) : null;
  }
  async prorrogas(contratoId: number): Promise<ProrrogaResumen[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT id, meses_prorroga, fecha_inicio_prorroga::text, fecha_fin_nueva::text
         FROM contrato_prorrogas WHERE contrato_id = $1 ORDER BY created_at ASC, id ASC`,
      [contratoId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      mesesProrroga: Number(r.meses_prorroga ?? 0),
      fechaInicioProrroga: toIso(r.fecha_inicio_prorroga) ?? '',
      fechaFinNueva: toIso(r.fecha_fin_nueva) ?? '',
    }));
  }
}

/**
 * Configuración del certificado (claves `cert_jefe_nombre`, `cert_jefe_cargo`,
 * `cert_firma_png`) y logo (`branding_logo_dark`) desde `app_settings`.
 * Las rutas de imagen del legado eran relativas a la raíz web
 * (`uploads/branding/x.png`); se resuelven contra el almacenamiento de uploads.
 */
@Injectable()
export class AppSettingsCertificadoConfigReader extends CertificadoConfigReader {
  static readonly DEFAULT_JEFE = 'Jefe Departamento Gestión Humana';

  constructor(
    @InjectRepository(AppSettingOrmEntity) private readonly settings: Repository<AppSettingOrmEntity>,
    private readonly storage: FileStorage,
  ) {
    super();
  }

  async get(): Promise<CertificadoConfig> {
    const rows = await this.settings.find({
      where: { setting_key: In(['cert_jefe_nombre', 'cert_jefe_cargo', 'cert_firma_png', 'branding_logo_dark']) },
    });
    const map = new Map(rows.map((r) => [r.setting_key, (r.value ?? '').trim()]));
    const val = (k: string, def = '') => map.get(k) || def;
    return {
      jefeNombre: val('cert_jefe_nombre', AppSettingsCertificadoConfigReader.DEFAULT_JEFE),
      jefeCargo: val('cert_jefe_cargo', AppSettingsCertificadoConfigReader.DEFAULT_JEFE),
      firmaPath: await this.resolve(val('cert_firma_png')),
      logoPath: (await this.resolveLogo(val('branding_logo_dark'))) ?? logoInstitucional(),
    };
  }

  /** El PDF sólo admite PNG/JPEG: un logo en SVG (o ausente) se sustituye por el institucional. */
  private async resolveLogo(ruta: string): Promise<string | null> {
    return /\.(png|jpe?g)$/i.test(ruta) ? this.resolve(ruta) : null;
  }

  private async resolve(ruta: string): Promise<string | null> {
    if (!ruta) return null;
    const relativa = ruta.replace(/^\/+/, '').replace(/^uploads\//, '');
    if (relativa.includes('..')) return null;
    try {
      return (await this.storage.exists(relativa)) ? this.storage.absolutePath(relativa) : null;
    } catch {
      return null;
    }
  }
}

/** Logo oficial empaquetado con el backend: respaldo cuando no hay logo configurado en la marca. */
function logoInstitucional(): string | null {
  const ruta = join(__dirname, '..', 'pdf', 'assets', 'comfasucre-logo.png');
  return existsSync(ruta) ? ruta : null;
}

/** Cédulas ya registradas en `users` (normalizadas sin guiones ni puntos), en una sola consulta. */
@Injectable()
export class TypeOrmCedulasExistentesReader extends CedulasExistentesReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async existentes(variantes: string[]): Promise<Set<string>> {
    const limpias = Array.from(new Set(variantes.filter((v) => v !== '')));
    if (limpias.length === 0) return new Set();
    const rows: Array<{ ced_norm: string }> = await this.dataSource.query(
      `SELECT REPLACE(REPLACE(TRIM(COALESCE(cedula,'')), '-', ''), '.', '') AS ced_norm
         FROM users
        WHERE REPLACE(REPLACE(TRIM(COALESCE(cedula,'')), '-', ''), '.', '') = ANY($1::text[])`,
      [limpias],
    );
    return new Set(rows.map((r) => r.ced_norm));
  }
}
