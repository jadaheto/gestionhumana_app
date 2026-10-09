import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PuntosInicializador } from '../../domain/usuario.repository';

/** Crea la fila de saldo en `puntos` (igual que `AdminUsuarios::guardar` en el legado). */
@Injectable()
export class TypeOrmPuntosInicializador extends PuntosInicializador {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async inicializar(userId: number): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO puntos (user_id, puntos_actuales) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }
}
