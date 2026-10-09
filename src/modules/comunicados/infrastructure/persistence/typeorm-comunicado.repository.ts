import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { Comunicado } from '../../domain/comunicado';
import { ComunicadoMedio, TipoMedio } from '../../domain/comunicado-medio';
import { ComunicadoConAutor, ComunicadoRepository } from '../../domain/comunicado.repository';
import { ComunicadoMedioOrmEntity } from './comunicado-medio.orm-entity';
import { ComunicadoOrmEntity } from './comunicado.orm-entity';

const toMedio = (r: ComunicadoMedioOrmEntity): ComunicadoMedio =>
  ComunicadoMedio.create({
    id: r.id,
    comunicadoId: r.comunicado_id,
    tipo: r.tipo as TipoMedio,
    archivo: r.archivo,
    url: r.url,
    orden: r.orden,
  });

const toDomain = (r: ComunicadoOrmEntity, medios: ComunicadoMedioOrmEntity[]): Comunicado =>
  Comunicado.create({
    id: r.id,
    titulo: r.titulo,
    resumen: r.resumen,
    contenido: r.contenido ?? '',
    estado: r.estado === 'publicado' ? 'publicado' : 'borrador',
    publicadoAt: r.publicado_at,
    emailEnviadoAt: r.email_enviado_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    medios: medios.map(toMedio),
  });

@Injectable()
export class TypeOrmComunicadoRepository extends ComunicadoRepository {
  constructor(
    @InjectRepository(ComunicadoOrmEntity) private readonly repo: Repository<ComunicadoOrmEntity>,
    @InjectRepository(ComunicadoMedioOrmEntity) private readonly medios: Repository<ComunicadoMedioOrmEntity>,
    @InjectRepository(UserOrmEntity) private readonly users: Repository<UserOrmEntity>,
  ) {
    super();
  }

  private async mediosDe(ids: number[]): Promise<Map<number, ComunicadoMedioOrmEntity[]>> {
    const map = new Map<number, ComunicadoMedioOrmEntity[]>();
    if (ids.length === 0) return map;
    const rows = await this.medios.find({ where: { comunicado_id: In(ids) }, order: { orden: 'ASC', id: 'ASC' } });
    for (const r of rows) {
      const list = map.get(r.comunicado_id) ?? [];
      list.push(r);
      map.set(r.comunicado_id, list);
    }
    return map;
  }

  async findAll(): Promise<ComunicadoConAutor[]> {
    const rows = await this.repo.find({ order: { created_at: 'DESC', id: 'DESC' } });
    const medios = await this.mediosDe(rows.map((r) => r.id));
    const autorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is number => id !== null))];
    const autores = autorIds.length
      ? await this.users.find({ select: ['id', 'first_name', 'last_name'], where: { id: In(autorIds) } })
      : [];
    const nombre = new Map(autores.map((u) => [u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || null]));
    return rows.map((r) => ({
      comunicado: toDomain(r, medios.get(r.id) ?? []),
      creadoPor: r.created_by ? (nombre.get(r.created_by) ?? null) : null,
    }));
  }

  async findById(id: number): Promise<Comunicado | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    const medios = await this.mediosDe([id]);
    return toDomain(row, medios.get(id) ?? []);
  }

  async findPublicados(page: PageRequest): Promise<Page<Comunicado>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { estado: 'publicado' },
      order: { publicado_at: 'DESC', id: 'DESC' },
      skip: (page.page - 1) * page.size,
      take: page.size,
    });
    const medios = await this.mediosDe(rows.map((r) => r.id));
    return { items: rows.map((r) => toDomain(r, medios.get(r.id) ?? [])), total, page: page.page, size: page.size };
  }

  async save(comunicado: Comunicado): Promise<Comunicado> {
    const p = comunicado.props;
    const data = {
      titulo: p.titulo,
      resumen: p.resumen,
      contenido: p.contenido,
      estado: p.estado,
      publicado_at: p.publicadoAt,
      email_enviado_at: p.emailEnviadoAt,
      created_by: p.createdBy,
      updated_at: p.updatedAt,
    };
    let id = p.id;
    if (id) {
      await this.repo.update({ id }, data);
    } else {
      const saved = await this.repo.save(this.repo.create({ ...data, created_at: p.createdAt }));
      id = saved.id;
    }

    // Sincroniza medios: elimina los que ya no están, inserta los nuevos y actualiza el orden.
    const existentes = await this.medios.find({ where: { comunicado_id: id } });
    const conservar = new Set(p.medios.map((m) => m.id).filter((x): x is number => x !== null));
    const borrar = existentes.filter((e) => !conservar.has(e.id)).map((e) => e.id);
    if (borrar.length) await this.medios.delete({ id: In(borrar) });
    for (const m of p.medios) {
      if (m.id) {
        await this.medios.update({ id: m.id }, { orden: m.props.orden });
      } else {
        await this.medios.save(
          this.medios.create({ comunicado_id: id, tipo: m.tipo, archivo: m.archivo, url: m.url, orden: m.props.orden }),
        );
      }
    }
    return (await this.findById(id)) ?? comunicado.withId(id);
  }

  async delete(id: number): Promise<void> {
    await this.medios.delete({ comunicado_id: id });
    await this.repo.delete({ id });
  }
}
