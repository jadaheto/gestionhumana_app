import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CAMPOS_IDENTIDAD,
  CampoIdentidad,
  esCampoIdentidad,
  IdentidadCampo,
  IdentidadRepository,
} from '../../domain/identidad';
import { IdentidadOrmEntity } from './identidad.orm-entity';

@Injectable()
export class TypeOrmIdentidadRepository extends IdentidadRepository {
  constructor(@InjectRepository(IdentidadOrmEntity) private readonly repo: Repository<IdentidadOrmEntity>) {
    super();
  }

  async findAll(): Promise<IdentidadCampo[]> {
    const rows = await this.repo.find({ order: { orden: 'ASC' } });
    return rows
      .filter((r) => esCampoIdentidad(r.campo))
      .map((r) => ({
        campo: r.campo as CampoIdentidad,
        contenido: r.contenido ?? '',
        tipo: r.tipo,
        orden: r.orden,
        updatedAt: r.updated_at,
      }));
  }

  async save(campo: CampoIdentidad, contenido: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { campo } });
    if (existing) {
      await this.repo.update({ campo }, { contenido, updated_at: new Date() });
      return;
    }
    await this.repo.save(
      this.repo.create({
        campo,
        contenido,
        tipo: campo === 'himno_url' ? 'video' : 'texto',
        orden: CAMPOS_IDENTIDAD.indexOf(campo) + 1,
      }),
    );
  }
}
