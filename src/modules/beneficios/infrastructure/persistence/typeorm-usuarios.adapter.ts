import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ColaboradorResumen, UsuariosPort } from '../../domain/ports';

/**
 * Implementación del puerto de usuarios/contratos con SQL parametrizado,
 * para no depender de otros módulos (users y contratos pertenecen a otros contextos).
 */
@Injectable()
export class TypeOrmUsuariosAdapter extends UsuariosPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findAdminsActivosIds(): Promise<number[]> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT id FROM users WHERE role = 'admin' AND estado_colaborador = 'activo' ORDER BY id`,
    );
    return rows.map((r) => Number(r.id));
  }

  /** Misma prioridad que `Vacaciones_model::get_fecha_ingreso_referencia`. */
  async findFechaIngresoReferencia(userId: number): Promise<string | null> {
    const activo: Array<{ fecha_inicio: string | Date | null }> = await this.dataSource.query(
      `SELECT fecha_inicio FROM contratos
        WHERE user_id = $1 AND estado = 'activo' AND fecha_inicio IS NOT NULL
        ORDER BY fecha_inicio DESC, id DESC LIMIT 1`,
      [userId],
    );
    if (activo[0]?.fecha_inicio) return toIsoDate(activo[0].fecha_inicio);

    const ultimo: Array<{ fecha_inicio: string | Date | null }> = await this.dataSource.query(
      `SELECT fecha_inicio FROM contratos
        WHERE user_id = $1 AND fecha_inicio IS NOT NULL
        ORDER BY fecha_inicio DESC, id DESC LIMIT 1`,
      [userId],
    );
    if (ultimo[0]?.fecha_inicio) return toIsoDate(ultimo[0].fecha_inicio);

    const user: Array<{ fecha_ingreso: string | Date | null }> = await this.dataSource.query(
      `SELECT fecha_ingreso FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return user[0]?.fecha_ingreso ? toIsoDate(user[0].fecha_ingreso) : null;
  }

  async findColaboradores(): Promise<ColaboradorResumen[]> {
    const rows: Array<{ id: number; first_name: string | null; last_name: string | null; cedula: string | null }> =
      await this.dataSource.query(
        `SELECT id, first_name, last_name, cedula FROM users
          WHERE estado_colaborador = 'activo'
          ORDER BY first_name ASC, last_name ASC`,
      );
    return rows.map((r) => ({
      id: Number(r.id),
      nombre: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      cedula: r.cedula ?? null,
    }));
  }

  async exists(userId: number): Promise<boolean> {
    const rows: Array<{ id: number }> = await this.dataSource.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [
      userId,
    ]);
    return rows.length > 0;
  }
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}
