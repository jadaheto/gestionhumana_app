import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActiveContractChecker } from '../../domain/active-contract-checker.port';

/** Consulta directa a `contratos` (misma regla que `User_model::has_active_contract`). */
@Injectable()
export class TypeOrmActiveContractChecker extends ActiveContractChecker {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async hasActiveContract(userId: number): Promise<boolean> {
    const rows: Array<{ id: number }> = await this.dataSource.query(
      `SELECT id FROM contratos
        WHERE user_id = $1 AND estado = 'activo'
          AND fecha_inicio <= CURRENT_DATE
          AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
        LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }
}
