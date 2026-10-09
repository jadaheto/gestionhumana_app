import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AreaOrmEntity } from '../../../../shared/infrastructure/persistence/orm/area.orm-entity';
import { CargoOrmEntity } from '../../../../shared/infrastructure/persistence/orm/cargo.orm-entity';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { Contrato } from '../../domain/contrato';
import { sumar } from '../../domain/fechas';
import { ContratoConColaborador, ContratoRepository } from '../../domain/repositories';
import { ColaboradorRaw, toContrato, toContratoConColaborador, toOrmData } from './contrato.mapper';
import { ContratoOrmEntity } from './contrato.orm-entity';

@Injectable()
export class TypeOrmContratoRepository extends ContratoRepository {
  constructor(@InjectRepository(ContratoOrmEntity) private readonly repo: Repository<ContratoOrmEntity>) {
    super();
  }

  /** Join con users/areas/cargos (`get_all` + `get_with_user`). */
  private conColaborador(): SelectQueryBuilder<ContratoOrmEntity> {
    return this.repo
      .createQueryBuilder('c')
      .leftJoin(UserOrmEntity, 'u', 'u.id = c.user_id')
      .leftJoin(AreaOrmEntity, 'a', 'a.id = u.area_id')
      .leftJoin(CargoOrmEntity, 'cg', 'cg.id = u.cargo_id')
      .addSelect('u.first_name', 'first_name')
      .addSelect('u.last_name', 'last_name')
      .addSelect('u.cedula', 'cedula')
      .addSelect('u.codigo_empresa', 'codigo_empresa')
      .addSelect('a.nombre', 'area_nombre')
      .addSelect('cg.nombre', 'cargo_nombre');
  }

  private async rows(qb: SelectQueryBuilder<ContratoOrmEntity>): Promise<ContratoConColaborador[]> {
    const { entities, raw } = await qb.getRawAndEntities<ColaboradorRaw>();
    return entities.map((e, i) => toContratoConColaborador(e, raw[i]));
  }

  findAll(): Promise<ContratoConColaborador[]> {
    return this.rows(this.conColaborador().orderBy('c.fecha_inicio', 'DESC').addOrderBy('c.id', 'DESC'));
  }

  findByUser(userId: number): Promise<ContratoConColaborador[]> {
    return this.rows(
      this.conColaborador()
        .where('c.user_id = :userId', { userId })
        .orderBy('c.fecha_inicio', 'DESC')
        .addOrderBy('c.id', 'DESC'),
    );
  }

  async findById(id: number): Promise<Contrato | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toContrato(row) : null;
  }

  async findByIdConColaborador(id: number): Promise<ContratoConColaborador | null> {
    const rows = await this.rows(this.conColaborador().where('c.id = :id', { id }));
    return rows[0] ?? null;
  }

  async save(contrato: Contrato): Promise<Contrato> {
    const data = toOrmData(contrato);
    if (contrato.props.id) {
      await this.repo.update({ id: contrato.props.id }, { ...data, updated_at: new Date() });
      return contrato;
    }
    const saved = await this.repo.save(this.repo.create(data));
    return contrato.withId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }

  async finalizarVencidos(hoy: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(ContratoOrmEntity)
      .set({ estado: 'finalizado', updated_at: () => 'CURRENT_TIMESTAMP' })
      .where("estado = 'activo' AND fecha_fin IS NOT NULL AND fecha_fin < CAST(:hoy AS date)", { hoy })
      .execute();
    return result.affected ?? 0;
  }

  findPorVencer(hoy: string, dias: number): Promise<ContratoConColaborador[]> {
    const hasta = sumar(hoy, { dias: Math.max(1, dias) });
    return this.rows(
      this.conColaborador()
        .where("c.estado = 'activo' AND c.fecha_fin IS NOT NULL")
        .andWhere('c.fecha_fin >= CAST(:hoy AS date)', { hoy })
        .andWhere('c.fecha_fin <= CAST(:hasta AS date)', { hasta })
        .orderBy('c.fecha_fin', 'ASC'),
    );
  }
}
