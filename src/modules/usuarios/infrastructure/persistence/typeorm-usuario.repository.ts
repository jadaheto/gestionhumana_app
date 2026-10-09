import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AreaOrmEntity } from '../../../../shared/infrastructure/persistence/orm/area.orm-entity';
import { CargoOrmEntity } from '../../../../shared/infrastructure/persistence/orm/cargo.orm-entity';
import { SedeOrmEntity } from '../../../../shared/infrastructure/persistence/orm/sede.orm-entity';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { Usuario } from '../../domain/usuario';
import { UsuarioConCatalogos, UsuarioRepository } from '../../domain/usuario.repository';

interface CatalogoRaw {
  sede_nombre: string | null;
  area_nombre: string | null;
  cargo_nombre: string | null;
}

export function toUsuario(row: UserOrmEntity): Usuario {
  return Usuario.create({
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    role: row.role === 'admin' ? 'admin' : 'funcionario',
    sedeId: row.sede_id,
    areaId: row.area_id,
    cargoId: row.cargo_id,
    estadoColaborador: row.estado_colaborador,
    profileImage: row.profile_image,
  });
}

@Injectable()
export class TypeOrmUsuarioRepository extends UsuarioRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {
    super();
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('u')
      .leftJoin(SedeOrmEntity, 's', 's.id = u.sede_id')
      .leftJoin(AreaOrmEntity, 'a', 'a.id = u.area_id')
      .leftJoin(CargoOrmEntity, 'c', 'c.id = u.cargo_id')
      .addSelect('s.nombre', 'sede_nombre')
      .addSelect('a.nombre', 'area_nombre')
      .addSelect('c.nombre', 'cargo_nombre');
  }

  private static merge(entities: UserOrmEntity[], raw: CatalogoRaw[]): UsuarioConCatalogos[] {
    return entities.map((e, i) => ({
      usuario: toUsuario(e),
      sedeNombre: raw[i]?.sede_nombre ?? null,
      areaNombre: raw[i]?.area_nombre ?? null,
      cargoNombre: raw[i]?.cargo_nombre ?? null,
    }));
  }

  async findAll(): Promise<UsuarioConCatalogos[]> {
    const { entities, raw } = await this.baseQuery()
      .orderBy('u.first_name', 'ASC')
      .addOrderBy('u.last_name', 'ASC')
      .getRawAndEntities<CatalogoRaw>();
    return TypeOrmUsuarioRepository.merge(entities, raw);
  }

  async findById(id: number): Promise<UsuarioConCatalogos | null> {
    const { entities, raw } = await this.baseQuery().where('u.id = :id', { id }).getRawAndEntities<CatalogoRaw>();
    return TypeOrmUsuarioRepository.merge(entities, raw)[0] ?? null;
  }

  async existsByUsername(username: string, excludeId?: number): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.username) = :username', { username: username.toLowerCase() });
    if (excludeId) qb.andWhere('u.id <> :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  async existsByEmail(email: string, excludeId?: number): Promise<boolean> {
    const qb = this.repo.createQueryBuilder('u').where('LOWER(u.email) = :email', { email: email.toLowerCase() });
    if (excludeId) qb.andWhere('u.id <> :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  async create(usuario: Usuario, passwordHash: string): Promise<Usuario> {
    const p = usuario.props;
    const saved = await this.repo.save(
      this.repo.create({
        username: p.username,
        email: p.email,
        password: passwordHash,
        first_name: p.firstName,
        last_name: p.lastName,
        role: p.role,
        sede_id: p.sedeId,
        area_id: p.areaId,
        cargo_id: p.cargoId,
        estado_colaborador: p.estadoColaborador,
      }),
    );
    return usuario.withId(saved.id);
  }

  async update(usuario: Usuario): Promise<void> {
    const p = usuario.props;
    await this.repo.update(
      { id: p.id as number },
      {
        email: p.email,
        first_name: p.firstName,
        last_name: p.lastName,
        role: p.role,
        sede_id: p.sedeId,
        area_id: p.areaId,
        cargo_id: p.cargoId,
        updated_at: new Date(),
      },
    );
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await this.repo.update({ id }, { password: passwordHash, updated_at: new Date() });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
