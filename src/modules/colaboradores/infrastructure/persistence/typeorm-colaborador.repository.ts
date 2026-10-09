import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AreaOrmEntity } from '../../../../shared/infrastructure/persistence/orm/area.orm-entity';
import { CargoOrmEntity } from '../../../../shared/infrastructure/persistence/orm/cargo.orm-entity';
import { SedeOrmEntity } from '../../../../shared/infrastructure/persistence/orm/sede.orm-entity';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { Colaborador } from '../../domain/colaborador';
import { ColaboradorConNombres, ColaboradorFilters, ColaboradorRepository } from '../../domain/colaborador.repository';

interface NombresRaw {
  sede_nombre: string | null;
  area_nombre: string | null;
  cargo_nombre: string | null;
  cargo_funciones: string | null;
}

export function toColaborador(r: UserOrmEntity): Colaborador {
  // Las filas heredadas pueden tener cédula vacía; se mantiene la fila legible sin romper el listado.
  return Colaborador.create({
    id: r.id,
    username: r.username,
    email: r.email || 'sin-correo@invalido.local',
    role: r.role,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    cedula: r.cedula?.trim() || 'N/A',
    codigoEmpresa: r.codigo_empresa,
    phoneNumber: r.phone_number,
    telefono: r.telefono,
    celular: r.celular,
    sedeId: r.sede_id,
    areaId: r.area_id,
    cargoId: r.cargo_id,
    estadoColaborador: r.estado_colaborador,
    fechaNacimiento: r.fecha_nacimiento,
    fechaIngreso: r.fecha_ingreso,
    genero: r.genero,
    estadoCivil: r.estado_civil,
    direccion: r.direccion,
    eps: r.eps,
    arl: r.arl,
    fondoPension: r.fondo_pension,
    cajaCompensacion: r.caja_compensacion,
    tipoSangre: r.tipo_sangre,
    designation: r.designation,
    profileImage: r.profile_image,
    numeroHijos: r.numero_hijos ?? 0,
  });
}

function toRow(c: Colaborador): QueryDeepPartialEntity<UserOrmEntity> {
  const p = c.props;
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email,
    cedula: p.cedula,
    codigo_empresa: p.codigoEmpresa,
    phone_number: p.phoneNumber,
    telefono: p.telefono,
    celular: p.celular,
    sede_id: p.sedeId,
    area_id: p.areaId,
    cargo_id: p.cargoId,
    estado_colaborador: p.estadoColaborador,
    fecha_nacimiento: p.fechaNacimiento,
    fecha_ingreso: p.fechaIngreso,
    genero: p.genero,
    estado_civil: p.estadoCivil,
    direccion: p.direccion,
    eps: p.eps,
    arl: p.arl,
    fondo_pension: p.fondoPension,
    caja_compensacion: p.cajaCompensacion,
    tipo_sangre: p.tipoSangre,
    designation: p.designation,
    updated_at: new Date(),
  };
}

@Injectable()
export class TypeOrmColaboradorRepository extends ColaboradorRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {
    super();
  }

  private withNames() {
    return this.repo
      .createQueryBuilder('u')
      .leftJoin(SedeOrmEntity, 's', 's.id = u.sede_id')
      .leftJoin(AreaOrmEntity, 'a', 'a.id = u.area_id')
      .leftJoin(CargoOrmEntity, 'c', 'c.id = u.cargo_id')
      .addSelect('s.nombre', 'sede_nombre')
      .addSelect('a.nombre', 'area_nombre')
      .addSelect('c.nombre', 'cargo_nombre')
      .addSelect('c.funciones', 'cargo_funciones');
  }

  async findAll(filters: ColaboradorFilters): Promise<ColaboradorConNombres[]> {
    const qb = this.withNames().where('u.role != :admin', { admin: 'admin' });
    if (filters.estado) qb.andWhere('u.estado_colaborador = :estado', { estado: filters.estado });
    if (filters.areaId) qb.andWhere('u.area_id = :areaId', { areaId: filters.areaId });
    if (filters.sedeId) qb.andWhere('u.sede_id = :sedeId', { sedeId: filters.sedeId });
    qb.orderBy('u.first_name', 'ASC').addOrderBy('u.last_name', 'ASC');
    const { entities, raw } = await qb.getRawAndEntities<NombresRaw>();
    return entities.map((e, i) => this.combine(e, raw[i]));
  }

  async findById(id: number): Promise<Colaborador | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toColaborador(row) : null;
  }

  async findDetalle(id: number): Promise<ColaboradorConNombres | null> {
    const { entities, raw } = await this.withNames().where('u.id = :id', { id }).getRawAndEntities<NombresRaw>();
    return entities.length ? this.combine(entities[0], raw[0]) : null;
  }

  async existsUsername(username: string): Promise<boolean> {
    return (await this.repo.count({ where: { username } })) > 0;
  }

  async existsEmail(email: string, excludeId?: number): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: email.trim().toLowerCase() });
    if (excludeId) qb.andWhere('u.id != :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  async existsCedula(cedula: string, excludeId?: number): Promise<boolean> {
    const qb = this.repo.createQueryBuilder('u').where('TRIM(u.cedula) = :cedula', { cedula: cedula.trim() });
    if (excludeId) qb.andWhere('u.id != :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  async existsCodigoEmpresa(codigo: string, excludeId?: number): Promise<boolean> {
    const qb = this.repo.createQueryBuilder('u').where('TRIM(u.codigo_empresa) = :codigo', { codigo: codigo.trim() });
    if (excludeId) qb.andWhere('u.id != :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  async create(colaborador: Colaborador, passwordHash: string): Promise<Colaborador> {
    const entity: DeepPartial<UserOrmEntity> = {
      ...(toRow(colaborador) as DeepPartial<UserOrmEntity>),
      username: colaborador.props.username,
      password: passwordHash,
      role: colaborador.props.role,
      profile_image: colaborador.props.profileImage,
      numero_hijos: colaborador.props.numeroHijos,
    };
    const saved = await this.repo.save(this.repo.create(entity));
    return colaborador.withId(saved.id);
  }

  async update(colaborador: Colaborador): Promise<void> {
    await this.repo.update({ id: colaborador.props.id as number }, toRow(colaborador));
  }

  async updateProfileImage(id: number, relativePath: string): Promise<void> {
    await this.repo.update({ id }, { profile_image: relativePath, updated_at: new Date() });
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ id, role: Not('admin') });
  }

  private combine(e: UserOrmEntity, raw: NombresRaw | undefined): ColaboradorConNombres {
    return {
      colaborador: toColaborador(e),
      sedeNombre: raw?.sede_nombre ?? null,
      areaNombre: raw?.area_nombre ?? null,
      cargoNombre: raw?.cargo_nombre ?? null,
      cargoFunciones: raw?.cargo_funciones ?? null,
    };
  }
}
