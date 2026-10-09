import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ColaboradorResumen, UsuariosPort } from '../../domain/ports';

/** Consultas directas a `users` (sin importar el módulo de colaboradores). */
@Injectable()
export class TypeOrmUsuariosAdapter extends UsuariosPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async listarColaboradores(): Promise<ColaboradorResumen[]> {
    const rows: Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      cedula: string | null;
      cargo_nombre: string | null;
    }> = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.cedula, c.nombre AS cargo_nombre
           FROM users u
           LEFT JOIN cargos c ON c.id = u.cargo_id
          WHERE u.role <> 'admin'
          ORDER BY u.first_name ASC, u.last_name ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      firstName: r.first_name ?? '',
      lastName: r.last_name ?? '',
      cedula: r.cedula,
      cargoNombre: r.cargo_nombre,
    }));
  }

  async existeUsuario(id: number): Promise<boolean> {
    const rows: Array<{ id: number }> = await this.dataSource.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows.length > 0;
  }

  async listarAdminsActivos(): Promise<number[]> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT id FROM users WHERE role = 'admin' AND estado_colaborador = 'activo' ORDER BY id`,
    );
    return rows.map((r) => r.id);
  }

  /** `Contrato_model::sync_user_status_by_contracts` con la fecha inyectada. */
  async sincronizarEstadoPorContratos(hoy: string): Promise<void> {
    const activoSql = `EXISTS (
      SELECT 1 FROM contratos c
       WHERE c.user_id = users.id
         AND c.estado = 'activo'
         AND c.fecha_inicio <= $1::date
         AND (c.fecha_fin IS NULL OR c.fecha_fin >= $1::date)
    )`;
    await this.dataSource.query(
      `UPDATE users SET estado_colaborador = 'activo'
        WHERE role <> 'admin' AND estado_colaborador <> 'retirado' AND estado_colaborador <> 'activo' AND ${activoSql}`,
      [hoy],
    );
    await this.dataSource.query(
      `UPDATE users SET estado_colaborador = 'inactivo'
        WHERE role <> 'admin' AND estado_colaborador <> 'retirado' AND estado_colaborador <> 'inactivo' AND NOT ${activoSql}`,
      [hoy],
    );
  }
}
