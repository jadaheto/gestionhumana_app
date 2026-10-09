import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ColaboradorBasico, ColaboradorFinder, SalarioReferenciaReader } from '../../domain/ports';

interface UserRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
  cedula: string | null;
  codigo_empresa: string | null;
}

const toColaborador = (r: UserRow): ColaboradorBasico => ({
  id: Number(r.id),
  firstName: r.first_name,
  lastName: r.last_name,
  cedula: r.cedula,
  codigoEmpresa: r.codigo_empresa,
});

/** Búsqueda sobre `users` (misma consulta que `Endeudamiento::buscar_colaborador`). */
@Injectable()
export class TypeOrmColaboradorFinder extends ColaboradorFinder {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async search(q: string): Promise<ColaboradorBasico[]> {
    const params: unknown[] = [];
    let where = `u.role <> 'admin'`;
    if (q !== '') {
      params.push(`%${q}%`);
      where += ` AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.cedula ILIKE $1 OR u.codigo_empresa ILIKE $1
                      OR (u.first_name || ' ' || u.last_name) ILIKE $1)`;
    }
    const rows: UserRow[] = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.cedula, u.codigo_empresa FROM users u WHERE ${where} ORDER BY u.first_name ASC, u.last_name ASC LIMIT 20`,
      params,
    );
    return rows.map(toColaborador);
  }

  async findById(id: number): Promise<ColaboradorBasico | null> {
    const rows: UserRow[] = await this.dataSource.query(
      `SELECT id, first_name, last_name, cedula, codigo_empresa FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows.length > 0 ? toColaborador(rows[0]) : null;
  }
}

/** Replica `Endeudamiento::get_salario_referencia`: contrato activo más reciente o tabla `cargo_salarios`. */
@Injectable()
export class TypeOrmSalarioReferenciaReader extends SalarioReferenciaReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async salarioReferencia(userId: number): Promise<number> {
    const contrato: Array<{ salario_base: string | null }> = await this.dataSource.query(
      `SELECT salario_base FROM contratos WHERE user_id = $1 AND estado = 'activo' ORDER BY fecha_inicio DESC, id DESC LIMIT 1`,
      [userId],
    );
    const salarioContrato = Number(contrato[0]?.salario_base ?? 0);
    if (salarioContrato > 0) return salarioContrato;

    const cargo: Array<{ salario_2024: string | null; aumento_2025: string | null }> = await this.dataSource.query(
      `SELECT cs.salario_2024, cs.aumento_2025 FROM users u LEFT JOIN cargo_salarios cs ON cs.cargo_id = u.cargo_id WHERE u.id = $1 LIMIT 1`,
      [userId],
    );
    const salario2024 = Number(cargo[0]?.salario_2024 ?? 0);
    if (salario2024 > 0) return salario2024 + Number(cargo[0]?.aumento_2025 ?? 0);
    return 0;
  }
}
