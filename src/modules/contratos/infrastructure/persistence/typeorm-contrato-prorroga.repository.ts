import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Contrato } from '../../domain/contrato';
import { ContratoProrroga } from '../../domain/contrato-prorroga';
import { ContratoProrrogaRepository } from '../../domain/repositories';
import { toOrmData, toProrroga } from './contrato.mapper';
import { ContratoOrmEntity } from './contrato.orm-entity';
import { ContratoProrrogaOrmEntity } from './contrato-prorroga.orm-entity';

@Injectable()
export class TypeOrmContratoProrrogaRepository extends ContratoProrrogaRepository {
  constructor(
    @InjectRepository(ContratoProrrogaOrmEntity) private readonly repo: Repository<ContratoProrrogaOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super();
  }

  /** Misma transacción que `registrar_prorroga`: inserta la prórroga y actualiza el contrato. */
  registrar(prorroga: ContratoProrroga, contratoActualizado: Contrato): Promise<ContratoProrroga> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(ContratoProrrogaOrmEntity, {
          contrato_id: prorroga.contratoId,
          user_id: prorroga.userId,
          fecha_fin_anterior: prorroga.fechaFinAnterior,
          meses_prorroga: prorroga.mesesProrroga,
          fecha_inicio_prorroga: prorroga.fechaInicioProrroga,
          fecha_fin_nueva: prorroga.fechaFinNueva,
          observacion: prorroga.observacion,
          creado_por: prorroga.creadoPor,
          created_at: prorroga.createdAt ?? new Date(),
        }),
      );
      await manager.update(
        ContratoOrmEntity,
        { id: prorroga.contratoId },
        { ...toOrmData(contratoActualizado), updated_at: new Date() },
      );
      return toProrroga(saved);
    });
  }

  async findByContrato(contratoId: number): Promise<ContratoProrroga[]> {
    const rows = await this.repo.find({ where: { contrato_id: contratoId }, order: { id: 'DESC' } });
    return rows.map(toProrroga);
  }
}
