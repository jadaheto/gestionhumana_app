import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Aniversario, ConexionesRepository, Cumpleanero } from '../../domain/conexiones.repository';
import { esColaboradorSql } from '../../../../shared/infrastructure/persistence/es-colaborador.sql';

/** Consultas de `Conexion_model` (cumpleaños y aniversarios laborales del día). */
@Injectable()
export class TypeOrmConexionesRepository extends ConexionesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async cumpleanerosHoy(): Promise<Cumpleanero[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image,
              to_char(u.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
              c.nombre AS cargo_nombre, a.nombre AS area_nombre
         FROM users u
         LEFT JOIN cargos c ON u.cargo_id = c.id
         LEFT JOIN areas a ON u.area_id = a.id
        WHERE EXTRACT(MONTH FROM u.fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM u.fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
          AND u.estado_colaborador = 'activo'
        ORDER BY u.first_name`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      firstName: String(r.first_name ?? ''),
      lastName: String(r.last_name ?? ''),
      profileImage: (r.profile_image as string | null) ?? null,
      fechaNacimiento: (r.fecha_nacimiento as string | null) ?? null,
      cargoNombre: (r.cargo_nombre as string | null) ?? null,
      areaNombre: (r.area_nombre as string | null) ?? null,
    }));
  }

  async aniversariosHoy(): Promise<Aniversario[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image,
              to_char(COALESCE(mc.fecha_inicio_min, u.fecha_ingreso), 'YYYY-MM-DD') AS fecha_referencia,
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)))::INT AS anios,
              c.nombre AS cargo_nombre, a.nombre AS area_nombre
         FROM users u
         LEFT JOIN (
              SELECT user_id, MIN(fecha_inicio) AS fecha_inicio_min
                FROM contratos WHERE fecha_inicio IS NOT NULL GROUP BY user_id
         ) mc ON mc.user_id = u.id
         LEFT JOIN cargos c ON u.cargo_id = c.id
         LEFT JOIN areas a ON u.area_id = a.id
        WHERE COALESCE(mc.fecha_inicio_min, u.fecha_ingreso) IS NOT NULL
          AND EXTRACT(MONTH FROM COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM COALESCE(mc.fecha_inicio_min, u.fecha_ingreso)) = EXTRACT(DAY FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(mc.fecha_inicio_min, u.fecha_ingreso))) >= 1
          AND u.estado_colaborador = 'activo'
          AND ${esColaboradorSql('u')}
        ORDER BY anios DESC, u.first_name ASC`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      firstName: String(r.first_name ?? ''),
      lastName: String(r.last_name ?? ''),
      profileImage: (r.profile_image as string | null) ?? null,
      fechaReferencia: (r.fecha_referencia as string | null) ?? null,
      anios: Number(r.anios ?? 0),
      cargoNombre: (r.cargo_nombre as string | null) ?? null,
      areaNombre: (r.area_nombre as string | null) ?? null,
    }));
  }
}
