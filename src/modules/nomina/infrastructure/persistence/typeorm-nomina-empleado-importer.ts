import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { TokenGenerator } from '../../../../shared/application/ports/token-generator.port';
import {
  baseLocalUsuario,
  buildPeriodoKey,
  cedulaUtil,
  dividirNombre,
  nombresOrganizacion,
  normalizarCedula,
  ResultadoImportacionEmpleado,
  totalesEmpleado,
} from '../../domain/nomina-import';
import { NominaEmpleado, NominaMeta } from '../../domain/nomina-parser';
import { NominaEmpleadoImporter, NominaImportSesion } from '../../domain/ports';

type Row = Record<string, unknown>;

/**
 * Port de `AdminUsuarios::import_nomina_employee` y helpers (`upsert_user_from_nomina`,
 * `upsert_sede_by_name`, `upsert_area_by_name`, `upsert_cargo_by_name`,
 * `build_unique_email`, `build_unique_username`).
 *
 * Cada empleado se importa dentro de una transacción propia; la sesión
 * conserva cachés de sede/área/cargo para no repetir consultas en la tanda.
 */
@Injectable()
export class TypeOrmNominaEmpleadoImporter extends NominaEmpleadoImporter {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {
    super();
  }

  iniciarSesion(): NominaImportSesion {
    const sedeCache = new Map<string, number>();
    const areaCache = new Map<string, number>();
    const cargoCache = new Map<string, number>();

    return {
      importar: (emp, meta, archivoPdf) =>
        this.dataSource.transaction((manager) =>
          this.importarEmpleado(manager, emp, meta, archivoPdf, { sedeCache, areaCache, cargoCache }),
        ),
    };
  }

  private async importarEmpleado(
    m: EntityManager,
    emp: NominaEmpleado,
    meta: NominaMeta,
    archivoPdf: string,
    cache: { sedeCache: Map<string, number>; areaCache: Map<string, number>; cargoCache: Map<string, number> },
  ): Promise<ResultadoImportacionEmpleado> {
    const cedula = cedulaUtil(emp);
    if (cedula === '') throw new Error('Empleado sin identificacion util para crear usuario.');

    const nombres = nombresOrganizacion(emp, meta);
    const sedeId = await this.upsertSede(m, nombres.sede, cache.sedeCache);
    const areaId = await this.upsertArea(m, nombres.area, sedeId, cache.areaCache);
    const cargoId = await this.upsertCargo(m, nombres.cargo, areaId, cache.cargoCache);

    const user = await this.upsertUser(m, emp, cedula, sedeId, areaId, cargoId);

    // Actualiza el salario del contrato activo con el sueldo base del PDF.
    let contratoActualizado = false;
    const sueldoPdf = Number(emp.sueldoBase) || 0;
    if (sueldoPdf > 0) {
      const contratos: Row[] = await m.query(
        `SELECT id, salario_base FROM contratos WHERE user_id = $1 AND estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1`,
        [user.userId],
      );
      const c = contratos[0];
      if (c && Math.abs(Number(c.salario_base) - sueldoPdf) > 0.01) {
        await m.query(`UPDATE contratos SET salario_base = $1, updated_at = NOW() WHERE id = $2`, [sueldoPdf, c.id]);
        contratoActualizado = true;
      }
    }

    const { totalDevengado, totalDeducido } = totalesEmpleado(emp);
    const periodo = buildPeriodoKey(meta);
    const payload = [
      user.userId,
      periodo,
      Number(emp.sueldoBase) || 0,
      JSON.stringify(emp.devengados ?? {}),
      JSON.stringify(emp.deducciones ?? {}),
      totalDevengado,
      totalDeducido,
      Number(emp.neto) || 0,
      meta.fechaInicio,
      meta.fechaFin,
      meta.fechaLiquidacion,
      String(emp.documentoNomina ?? '').slice(0, 30),
      archivoPdf,
    ];

    const existente: Row[] = await m.query(
      `SELECT id FROM desprendibles_nomina
        WHERE user_id = $1 AND periodo = $2
          AND fecha_inicio IS NOT DISTINCT FROM $3::date AND fecha_fin IS NOT DISTINCT FROM $4::date
        LIMIT 1`,
      [user.userId, periodo, meta.fechaInicio, meta.fechaFin],
    );

    if (existente[0]) {
      await m.query(
        `UPDATE desprendibles_nomina
            SET user_id = $1, periodo = $2, salario_basico = $3, devengados = $4::jsonb, deducciones = $5::jsonb,
                total_devengado = $6, total_deducido = $7, neto_pagar = $8, fecha_inicio = $9, fecha_fin = $10,
                fecha_liquidacion = $11, nro_comprobante = $12, archivo_pdf = $13, created_at = NOW()
          WHERE id = $14`,
        [...payload, existente[0].id],
      );
      return { empleadoCreado: user.created, desprendibleCreado: false, contratoActualizado };
    }

    await m.query(
      `INSERT INTO desprendibles_nomina
         (user_id, periodo, salario_basico, devengados, deducciones, total_devengado, total_deducido, neto_pagar,
          fecha_inicio, fecha_fin, fecha_liquidacion, nro_comprobante, archivo_pdf, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      payload,
    );
    return { empleadoCreado: user.created, desprendibleCreado: true, contratoActualizado };
  }

  private async upsertUser(
    m: EntityManager,
    emp: NominaEmpleado,
    cedula: string,
    sedeId: number,
    areaId: number,
    cargoId: number,
  ): Promise<{ userId: number; created: boolean }> {
    const cedulaNorm = normalizarCedula(cedula);
    // Variante con dígito de verificación (por si el usuario ya estaba guardado como "1102879310-2").
    const cedulaRawNorm = normalizarCedula(emp.cedulaRaw || cedula);
    const found: Row[] = await m.query(
      `SELECT id FROM users WHERE REPLACE(REPLACE(TRIM(COALESCE(cedula,'')), '-', ''), '.', '') IN ($1, $2) LIMIT 1`,
      [cedulaNorm, cedulaRawNorm],
    );
    const { firstName, lastName } = dividirNombre(emp.nombre);
    const designation = String(emp.cargo ?? '').slice(0, 100);

    if (found[0]) {
      const userId = Number(found[0].id);
      // Nota: no se toca codigo_empresa — el "Documento N°" del PDF es el comprobante del período.
      await m.query(
        `UPDATE users
            SET first_name = $1, last_name = $2, designation = $3, cedula = $4, sede_id = $5, area_id = $6, cargo_id = $7,
                estado_colaborador = 'activo', role = 'funcionario', updated_at = NOW()
          WHERE id = $8`,
        [firstName, lastName, designation, cedula, sedeId, areaId, cargoId, userId],
      );
      await m.query(
        `INSERT INTO puntos (user_id, puntos_actuales, puntos_totales_ganados) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      return { userId, created: false };
    }

    const base = baseLocalUsuario(emp, cedulaNorm, firstName, lastName, this.clock.now());
    const email = await this.uniqueEmail(m, `${base}@nomina.local`);
    const username = await this.uniqueUsername(m, `nom${base}`);
    // Contraseña aleatoria: el admin debe restablecerla para cada usuario importado.
    const password = await this.hasher.hash(this.tokens.temporaryPassword());
    const inserted: Row[] = await m.query(
      `INSERT INTO users
         (username, email, password, first_name, last_name, designation, cedula, sede_id, area_id, cargo_id,
          estado_colaborador, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'activo', 'funcionario', NOW(), NOW())
       RETURNING id`,
      [username, email, password, firstName, lastName, designation, cedula, sedeId, areaId, cargoId],
    );
    const userId = Number(inserted[0].id);
    await m.query(
      `INSERT INTO puntos (user_id, puntos_actuales, puntos_totales_ganados) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    return { userId, created: true };
  }

  private async upsertSede(m: EntityManager, nombre: string, cache: Map<string, number>): Promise<number> {
    const key = nombre.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const rows: Row[] = await m.query(`SELECT id FROM sedes WHERE LOWER(TRIM(nombre)) = $1 LIMIT 1`, [key]);
    let id: number;
    if (rows[0]) id = Number(rows[0].id);
    else {
      const ins: Row[] = await m.query(
        `INSERT INTO sedes (nombre, estado, created_at) VALUES ($1, 'activo', NOW()) RETURNING id`,
        [nombre],
      );
      id = Number(ins[0].id);
    }
    cache.set(key, id);
    return id;
  }

  private async upsertArea(
    m: EntityManager,
    nombre: string,
    sedeId: number,
    cache: Map<string, number>,
  ): Promise<number> {
    const key = nombre.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const rows: Row[] = await m.query(`SELECT id FROM areas WHERE LOWER(TRIM(nombre)) = $1 LIMIT 1`, [key]);
    let id: number;
    if (rows[0]) id = Number(rows[0].id);
    else {
      const ins: Row[] = await m.query(
        `INSERT INTO areas (nombre, sede_id, estado, created_at) VALUES ($1, $2, 'activo', NOW()) RETURNING id`,
        [nombre, sedeId],
      );
      id = Number(ins[0].id);
    }
    cache.set(key, id);
    return id;
  }

  private async upsertCargo(
    m: EntityManager,
    nombre: string,
    areaId: number,
    cache: Map<string, number>,
  ): Promise<number> {
    const key = `${areaId}|${nombre.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const rows: Row[] = await m.query(`SELECT id FROM cargos WHERE area_id = $1 AND LOWER(TRIM(nombre)) = $2 LIMIT 1`, [
      areaId,
      nombre.toLowerCase(),
    ]);
    let id: number;
    if (rows[0]) id = Number(rows[0].id);
    else {
      const ins: Row[] = await m.query(
        `INSERT INTO cargos (nombre, area_id, estado, nivel_jerarquico, created_at) VALUES ($1, $2, 'activo', 5, NOW()) RETURNING id`,
        [nombre, areaId],
      );
      id = Number(ins[0].id);
    }
    cache.set(key, id);
    return id;
  }

  private async uniqueEmail(m: EntityManager, email: string): Promise<string> {
    let e = email.toLowerCase().trim();
    if (!e.includes('@')) e += '@nomina.local';
    const [local, domain = 'nomina.local'] = e.split('@', 2);
    let candidate = `${local}@${domain}`;
    for (let i = 1; ; i++) {
      const rows: Row[] = await m.query(`SELECT COUNT(*) AS n FROM users WHERE LOWER(email) = $1`, [candidate]);
      if (Number(rows[0]?.n ?? 0) === 0) return candidate;
      candidate = `${local}${i}@${domain}`;
    }
  }

  private async uniqueUsername(m: EntityManager, base: string): Promise<string> {
    let b = base.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (b === '') b = 'nomina';
    let candidate = b;
    for (let i = 1; ; i++) {
      const rows: Row[] = await m.query(`SELECT COUNT(*) AS n FROM users WHERE username = $1`, [candidate]);
      if (Number(rows[0]?.n ?? 0) === 0) return candidate;
      candidate = `${b}${i}`;
    }
  }
}
