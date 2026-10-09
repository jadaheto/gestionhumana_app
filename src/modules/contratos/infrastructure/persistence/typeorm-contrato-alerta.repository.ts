import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContratoAlerta } from '../../domain/contrato-prorroga';
import { ContratoAlertaRepository } from '../../domain/repositories';
import { ContratoAlertaOrmEntity } from './contrato-alerta.orm-entity';

@Injectable()
export class TypeOrmContratoAlertaRepository extends ContratoAlertaRepository {
  constructor(@InjectRepository(ContratoAlertaOrmEntity) private readonly repo: Repository<ContratoAlertaOrmEntity>) {
    super();
  }

  async exists(a: ContratoAlerta): Promise<boolean> {
    return this.repo.exists({
      where: {
        contrato_id: a.contratoId,
        destinatario_id: a.destinatarioId,
        alerta_tipo: a.alertaTipo,
        alerta_fecha: a.alertaFecha,
      },
    });
  }

  /** `ON CONFLICT DO NOTHING` sobre el índice único para tolerar cargas concurrentes. */
  async save(a: ContratoAlerta): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ContratoAlertaOrmEntity)
      .values({
        contrato_id: a.contratoId,
        destinatario_id: a.destinatarioId,
        alerta_tipo: a.alertaTipo,
        alerta_fecha: a.alertaFecha,
      })
      .orIgnore()
      .execute();
  }
}
