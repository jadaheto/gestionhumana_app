import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { FilaDependencia, normalizarTipoDependencia } from '../../domain/dependencias';
import { ColaboradorDirectorio, FiltrosDirectorio } from '../../domain/directorio';
import { FilaOrganigrama } from '../../domain/organigrama';
import {
  DependenciasRepository,
  DirectorioRepository,
  ImportacionCargosRepository,
  OrganigramaRepository,
} from '../../domain/repositories';
import { esColaboradorSql } from '../../../../shared/infrastructure/persistence/es-colaborador.sql';

interface FilaOrganigramaRaw {
  id: number;
  cargo_id: number;
  cargo_padre_id: number | null;
  orden: number | null;
  cargo_nombre: string;
  nivel_jerarquico: number | null;
  area_nombre: string | null;
  user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  profile_image: string | null;
}

/** Misma consulta que `Organigrama_model::get_jerarquia`. */
@Injectable()
export class TypeOrmOrganigramaRepository extends OrganigramaRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findFilas(): Promise<FilaOrganigrama[]> {
    const rows: FilaOrganigramaRaw[] = await this.dataSource.query(
      `SELECT o.id, o.cargo_id, o.cargo_padre_id, o.orden,
              c.nombre AS cargo_nombre, c.nivel_jerarquico,
              a.nombre AS area_nombre,
              u.id AS user_id, u.first_name, u.last_name, u.profile_image
         FROM organigrama o
         JOIN cargos c ON o.cargo_id = c.id
         LEFT JOIN areas a ON c.area_id = a.id
         LEFT JOIN users u ON u.cargo_id = c.id AND u.estado_colaborador = 'activo'
        ORDER BY c.nivel_jerarquico ASC, o.orden ASC, u.first_name ASC`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      cargoId: Number(r.cargo_id),
      cargoPadreId: r.cargo_padre_id === null ? null : Number(r.cargo_padre_id),
      orden: Number(r.orden ?? 0),
      cargoNombre: r.cargo_nombre,
      nivelJerarquico: Number(r.nivel_jerarquico ?? 5),
      areaNombre: r.area_nombre,
      titular:
        r.user_id === null
          ? null
          : {
              userId: Number(r.user_id),
              firstName: r.first_name ?? '',
              lastName: r.last_name ?? '',
              profileImage: r.profile_image,
            },
    }));
  }
}

interface FilaDependenciaRaw {
  id: number;
  nombre: string;
  padre_id: number | null;
  orden: number | null;
  tipo: string | null;
  user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  profile_image: string | null;
  cargo: string | null;
  total_colaboradores: string | number;
}

/** Áreas activas con su responsable y el número de colaboradores activos (sin administradores). */
@Injectable()
export class TypeOrmDependenciasRepository extends DependenciasRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findFilas(): Promise<FilaDependencia[]> {
    const rows: FilaDependenciaRaw[] = await this.dataSource.query(
      `SELECT a.id, a.nombre, a.padre_id, a.orden, a.tipo,
              u.id AS user_id, u.first_name, u.last_name, u.profile_image,
              COALESCE(c.nombre, u.designation) AS cargo,
              (SELECT COUNT(*) FROM users x
                WHERE x.area_id = a.id AND x.estado_colaborador = 'activo' AND ${esColaboradorSql('x')}) AS total_colaboradores
         FROM areas a
         LEFT JOIN users u ON u.id = a.responsable_id
         LEFT JOIN cargos c ON c.id = u.cargo_id
        WHERE a.estado = 'activo'
        ORDER BY a.orden ASC, a.nombre ASC`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      nombre: r.nombre,
      padreId: r.padre_id === null ? null : Number(r.padre_id),
      orden: Number(r.orden ?? 0),
      tipo: normalizarTipoDependencia(r.tipo),
      responsable:
        r.user_id === null
          ? null
          : {
              userId: Number(r.user_id),
              nombre: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
              cargo: r.cargo?.trim() || null,
              profileImage: r.profile_image,
            },
      totalColaboradores: Number(r.total_colaboradores ?? 0),
    }));
  }
}

interface ColaboradorRaw {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  celular: string | null;
  profile_image: string | null;
  designation: string | null;
  cargo_nombre: string | null;
  area_id: number | null;
  area_nombre: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
}

/** Misma consulta que `Organigrama_model::get_directorio` más filtros opcionales. */
@Injectable()
export class TypeOrmDirectorioRepository extends DirectorioRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async buscar(filtros: FiltrosDirectorio): Promise<ColaboradorDirectorio[]> {
    const condiciones: string[] = [`u.estado_colaborador = 'activo'`, esColaboradorSql('u')];
    const params: unknown[] = [];
    if (filtros.q) {
      params.push(`%${filtros.q}%`);
      const i = params.length;
      condiciones.push(
        `(u.first_name ILIKE $${i} OR u.last_name ILIKE $${i} OR (u.first_name || ' ' || u.last_name) ILIKE $${i} ` +
          `OR u.email ILIKE $${i} OR c.nombre ILIKE $${i} OR u.designation ILIKE $${i})`,
      );
    }
    if (filtros.areaId) {
      params.push(filtros.areaId);
      condiciones.push(`u.area_id = $${params.length}`);
    }
    if (filtros.sedeId) {
      params.push(filtros.sedeId);
      condiciones.push(`u.sede_id = $${params.length}`);
    }
    const rows: ColaboradorRaw[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.celular,
              u.profile_image, u.designation,
              c.nombre AS cargo_nombre, u.area_id, a.nombre AS area_nombre, u.sede_id, s.nombre AS sede_nombre
         FROM users u
         LEFT JOIN cargos c ON u.cargo_id = c.id
         LEFT JOIN areas a ON u.area_id = a.id
         LEFT JOIN sedes s ON u.sede_id = s.id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY u.first_name ASC, u.last_name ASC`,
      params,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      firstName: r.first_name ?? '',
      lastName: r.last_name ?? '',
      nombreCompleto: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      email: r.email,
      telefono: r.celular || r.phone_number || null,
      cargo: r.cargo_nombre || r.designation || null,
      areaId: r.area_id === null ? null : Number(r.area_id),
      area: r.area_nombre,
      sedeId: r.sede_id === null ? null : Number(r.sede_id),
      sede: r.sede_nombre,
      profileImage: r.profile_image,
    }));
  }
}

/**
 * Escrituras del importador. Fuera de `enTransaccion` usa el DataSource;
 * dentro, un `EntityManager` transaccional (rollback automático si falla).
 */
@Injectable()
export class TypeOrmImportacionCargosRepository extends ImportacionCargosRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly manager?: EntityManager,
  ) {
    super();
  }

  private query<T = unknown>(sql: string, params: unknown[]): Promise<T[]> {
    return (this.manager ?? this.dataSource).query<T[]>(sql, params);
  }

  enTransaccion<T>(trabajo: (repo: ImportacionCargosRepository) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      trabajo(new TypeOrmImportacionCargosRepository(this.dataSource, manager)),
    );
  }

  async findAreaIdPorNombre(nombre: string): Promise<number | null> {
    const rows = await this.query<{ id: number }>(
      `SELECT id FROM areas WHERE LOWER(TRIM(nombre)) = LOWER($1) LIMIT 1`,
      [nombre.trim()],
    );
    return rows[0] ? Number(rows[0].id) : null;
  }

  async crearArea(nombre: string): Promise<number> {
    const rows = await this.query<{ id: number }>(
      `INSERT INTO areas (nombre, estado) VALUES ($1, 'activo') RETURNING id`,
      [nombre],
    );
    return Number(rows[0].id);
  }

  async findCargoIdPorNombre(areaId: number, nombre: string): Promise<number | null> {
    const rows = await this.query<{ id: number }>(
      `SELECT id FROM cargos WHERE area_id = $1 AND LOWER(TRIM(nombre)) = LOWER($2) LIMIT 1`,
      [areaId, nombre.trim()],
    );
    return rows[0] ? Number(rows[0].id) : null;
  }

  async crearCargo(areaId: number, nombre: string): Promise<number> {
    const rows = await this.query<{ id: number }>(
      `INSERT INTO cargos (nombre, area_id, estado, nivel_jerarquico) VALUES ($1, $2, 'activo', 5) RETURNING id`,
      [nombre, areaId],
    );
    return Number(rows[0].id);
  }

  async upsertSalario(cargoId: number, salario2024: number | null, aumento2025: number | null): Promise<void> {
    await this.query(
      `INSERT INTO cargo_salarios (cargo_id, salario_2024, aumento_2025, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (cargo_id) DO UPDATE SET salario_2024 = EXCLUDED.salario_2024, aumento_2025 = EXCLUDED.aumento_2025, updated_at = NOW()`,
      [cargoId, salario2024, aumento2025],
    );
  }
}
