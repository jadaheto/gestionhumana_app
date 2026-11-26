import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AreaOrmEntity } from '../../../../shared/infrastructure/persistence/orm/area.orm-entity';
import { CargoOrmEntity } from '../../../../shared/infrastructure/persistence/orm/cargo.orm-entity';
import { SedeOrmEntity } from '../../../../shared/infrastructure/persistence/orm/sede.orm-entity';
import { Area } from '../../domain/area';
import { Cargo } from '../../domain/cargo';
import { AreaRepository, CargoRepository, SedeRepository } from '../../domain/repositories';
import { Sede } from '../../domain/sede';

const toSede = (r: SedeOrmEntity): Sede =>
  Sede.create({
    id: r.id,
    nombre: r.nombre,
    direccion: r.direccion,
    ciudad: r.ciudad,
    telefono: r.telefono,
    estado: r.estado === 'inactivo' ? 'inactivo' : 'activo',
  });

const toArea = (r: AreaOrmEntity): Area =>
  Area.create({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    sedeId: r.sede_id,
    responsableId: r.responsable_id,
    padreId: r.padre_id,
    orden: r.orden,
    tipo: r.tipo,
    estado: r.estado === 'inactivo' ? 'inactivo' : 'activo',
  });

const toCargo = (r: CargoOrmEntity): Cargo =>
  Cargo.create({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    areaId: r.area_id,
    nivelJerarquico: r.nivel_jerarquico,
    funciones: r.funciones,
    estado: r.estado === 'inactivo' ? 'inactivo' : 'activo',
  });

@Injectable()
export class TypeOrmSedeRepository extends SedeRepository {
  constructor(@InjectRepository(SedeOrmEntity) private readonly repo: Repository<SedeOrmEntity>) {
    super();
  }
  async findAll(soloActivas = false): Promise<Sede[]> {
    const rows = await this.repo.find({ where: soloActivas ? { estado: 'activo' } : {}, order: { nombre: 'ASC' } });
    return rows.map(toSede);
  }
  async findById(id: number): Promise<Sede | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toSede(row) : null;
  }
  async save(sede: Sede): Promise<Sede> {
    const p = sede.props;
    const data = { nombre: p.nombre, direccion: p.direccion, ciudad: p.ciudad, telefono: p.telefono, estado: p.estado };
    if (p.id) {
      await this.repo.update({ id: p.id }, data);
      return sede;
    }
    const saved = await this.repo.save(this.repo.create(data));
    return sede.withId(saved.id);
  }
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}

@Injectable()
export class TypeOrmAreaRepository extends AreaRepository {
  constructor(@InjectRepository(AreaOrmEntity) private readonly repo: Repository<AreaOrmEntity>) {
    super();
  }
  async findAll(soloActivas = false): Promise<Array<{ area: Area; sedeNombre: string | null }>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoin(SedeOrmEntity, 's', 's.id = a.sede_id')
      .addSelect('s.nombre', 'sede_nombre')
      .orderBy('a.nombre', 'ASC');
    if (soloActivas) qb.where('a.estado = :estado', { estado: 'activo' });
    const { entities, raw } = await qb.getRawAndEntities<{ sede_nombre: string | null }>();
    return entities.map((e, i) => ({ area: toArea(e), sedeNombre: raw[i]?.sede_nombre ?? null }));
  }
  async findById(id: number): Promise<Area | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toArea(row) : null;
  }
  async save(area: Area): Promise<Area> {
    const p = area.props;
    const data = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      sede_id: p.sedeId,
      responsable_id: p.responsableId,
      padre_id: p.padreId,
      orden: p.orden,
      tipo: p.tipo,
      estado: p.estado,
    };
    if (p.id) {
      await this.repo.update({ id: p.id }, data);
      return area;
    }
    const saved = await this.repo.save(this.repo.create(data));
    return area.withId(saved.id);
  }
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}

@Injectable()
export class TypeOrmCargoRepository extends CargoRepository {
  constructor(@InjectRepository(CargoOrmEntity) private readonly repo: Repository<CargoOrmEntity>) {
    super();
  }
  async findAll(soloActivos = false): Promise<Array<{ cargo: Cargo; areaNombre: string | null }>> {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoin(AreaOrmEntity, 'a', 'a.id = c.area_id')
      .addSelect('a.nombre', 'area_nombre')
      .orderBy('c.nivel_jerarquico', 'ASC')
      .addOrderBy('c.nombre', 'ASC');
    if (soloActivos) qb.where('c.estado = :estado', { estado: 'activo' });
    const { entities, raw } = await qb.getRawAndEntities<{ area_nombre: string | null }>();
    return entities.map((e, i) => ({ cargo: toCargo(e), areaNombre: raw[i]?.area_nombre ?? null }));
  }
  async findById(id: number): Promise<Cargo | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toCargo(row) : null;
  }
  async save(cargo: Cargo): Promise<Cargo> {
    const p = cargo.props;
    const data = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      area_id: p.areaId,
      nivel_jerarquico: p.nivelJerarquico,
      funciones: p.funciones,
      estado: p.estado,
    };
    if (p.id) {
      await this.repo.update({ id: p.id }, data);
      return cargo;
    }
    const saved = await this.repo.save(this.repo.create(data));
    return cargo.withId(saved.id);
  }
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
