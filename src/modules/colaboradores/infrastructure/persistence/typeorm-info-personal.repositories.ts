import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, ObjectLiteral, Repository } from 'typeorm';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import {
  DatosBasicos,
  DatosBasicosProps,
  DatosBasicosRepository,
  EducacionFormal,
  EducacionFormalRepository,
  EducacionNoFormal,
  EducacionNoFormalRepository,
  ExperienciaLaboral,
  ExperienciaLaboralRepository,
  Familiar,
  FamiliarRepository,
  OwnedRecord,
} from '../../domain/info-personal';
import {
  EducacionFormalOrmEntity,
  EducacionNoFormalOrmEntity,
  ExperienciaLaboralOrmEntity,
  FamiliarOrmEntity,
} from './info-personal.orm-entities';

interface OwnedOrm extends ObjectLiteral {
  id: number;
  user_id: number;
}

/** Operaciones comunes de las tablas con `user_id`; cada subclase aporta el mapeo. */
abstract class OwnedTypeOrmRepository<TOrm extends OwnedOrm, TDomain extends OwnedRecord> {
  protected constructor(
    protected readonly repo: Repository<TOrm>,
    private readonly order: FindOptionsOrder<TOrm>,
  ) {}

  protected abstract toDomain(row: TOrm): TDomain;
  protected abstract toRow(record: TDomain): Partial<TOrm>;
  protected abstract withId(record: TDomain, id: number): TDomain;

  async findByUser(userId: number): Promise<TDomain[]> {
    const rows = await this.repo.find({ where: { user_id: userId } as never, order: this.order });
    return rows.map((r) => this.toDomain(r));
  }

  async findOne(id: number, userId: number): Promise<TDomain | null> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } as never });
    return row ? this.toDomain(row) : null;
  }

  async insert(record: TDomain): Promise<TDomain> {
    const entity = this.repo.create({ ...this.toRow(record), user_id: record.userId } as unknown as TOrm);
    const saved = await this.repo.save(entity);
    return this.withId(record, saved.id);
  }

  async update(record: TDomain): Promise<TDomain> {
    // Evita IDOR: sólo actualiza si el registro pertenece al usuario.
    await this.repo.update({ id: record.id as number, user_id: record.userId } as never, this.toRow(record));
    return record;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.repo.delete({ id, user_id: userId } as never);
  }
}

@Injectable()
export class TypeOrmEducacionFormalRepository
  extends OwnedTypeOrmRepository<EducacionFormalOrmEntity, EducacionFormal>
  implements EducacionFormalRepository
{
  constructor(@InjectRepository(EducacionFormalOrmEntity) repo: Repository<EducacionFormalOrmEntity>) {
    super(repo, { fecha_inicio: 'DESC', id: 'DESC' });
  }
  protected toDomain(r: EducacionFormalOrmEntity): EducacionFormal {
    return EducacionFormal.create({
      id: r.id,
      userId: r.user_id,
      nivel: r.nivel,
      institucion: r.institucion,
      tituloObtenido: r.titulo_obtenido,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      estadoEstudio: r.estado_estudio,
      tarjetaProfesional: r.tarjeta_profesional,
    });
  }
  protected toRow(e: EducacionFormal): Partial<EducacionFormalOrmEntity> {
    const p = e.props;
    return {
      nivel: p.nivel,
      institucion: p.institucion,
      titulo_obtenido: p.tituloObtenido,
      fecha_inicio: p.fechaInicio,
      fecha_fin: p.fechaFin,
      estado_estudio: p.estadoEstudio,
      tarjeta_profesional: p.tarjetaProfesional,
    };
  }
  protected withId(e: EducacionFormal, id: number): EducacionFormal {
    return e.withId(id);
  }
}

@Injectable()
export class TypeOrmEducacionNoFormalRepository
  extends OwnedTypeOrmRepository<EducacionNoFormalOrmEntity, EducacionNoFormal>
  implements EducacionNoFormalRepository
{
  constructor(@InjectRepository(EducacionNoFormalOrmEntity) repo: Repository<EducacionNoFormalOrmEntity>) {
    super(repo, { fecha: 'DESC', id: 'DESC' });
  }
  protected toDomain(r: EducacionNoFormalOrmEntity): EducacionNoFormal {
    return EducacionNoFormal.create({
      id: r.id,
      userId: r.user_id,
      tipo: r.tipo,
      institucion: r.institucion,
      nombrePrograma: r.nombre_programa,
      horas: r.horas,
      fecha: r.fecha,
      certificado: r.certificado,
    });
  }
  protected toRow(e: EducacionNoFormal): Partial<EducacionNoFormalOrmEntity> {
    const p = e.props;
    return {
      tipo: p.tipo,
      institucion: p.institucion,
      nombre_programa: p.nombrePrograma,
      horas: p.horas,
      fecha: p.fecha,
      certificado: p.certificado,
    };
  }
  protected withId(e: EducacionNoFormal, id: number): EducacionNoFormal {
    return e.withId(id);
  }
}

@Injectable()
export class TypeOrmFamiliarRepository
  extends OwnedTypeOrmRepository<FamiliarOrmEntity, Familiar>
  implements FamiliarRepository
{
  constructor(@InjectRepository(FamiliarOrmEntity) repo: Repository<FamiliarOrmEntity>) {
    super(repo, { nombre_completo: 'ASC' });
  }
  protected toDomain(r: FamiliarOrmEntity): Familiar {
    return Familiar.create({
      id: r.id,
      userId: r.user_id,
      nombreCompleto: r.nombre_completo,
      parentesco: r.parentesco,
      fechaNacimiento: r.fecha_nacimiento,
      cedula: r.cedula,
      ocupacion: r.ocupacion,
      telefono: r.telefono,
      dependiente: r.dependiente,
    });
  }
  protected toRow(f: Familiar): Partial<FamiliarOrmEntity> {
    const p = f.props;
    return {
      nombre_completo: p.nombreCompleto,
      parentesco: p.parentesco,
      fecha_nacimiento: p.fechaNacimiento,
      cedula: p.cedula,
      ocupacion: p.ocupacion,
      telefono: p.telefono,
      dependiente: p.dependiente,
    };
  }
  protected withId(f: Familiar, id: number): Familiar {
    return f.withId(id);
  }
}

@Injectable()
export class TypeOrmExperienciaLaboralRepository
  extends OwnedTypeOrmRepository<ExperienciaLaboralOrmEntity, ExperienciaLaboral>
  implements ExperienciaLaboralRepository
{
  constructor(@InjectRepository(ExperienciaLaboralOrmEntity) repo: Repository<ExperienciaLaboralOrmEntity>) {
    super(repo, { fecha_inicio: 'DESC', id: 'DESC' });
  }
  protected toDomain(r: ExperienciaLaboralOrmEntity): ExperienciaLaboral {
    return ExperienciaLaboral.create({
      id: r.id,
      userId: r.user_id,
      empresa: r.empresa,
      cargo: r.cargo,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      funciones: r.funciones,
      motivoRetiro: r.motivo_retiro,
      telefonoContacto: r.telefono_contacto,
      jefeInmediato: r.jefe_inmediato,
    });
  }
  protected toRow(e: ExperienciaLaboral): Partial<ExperienciaLaboralOrmEntity> {
    const p = e.props;
    return {
      empresa: p.empresa,
      cargo: p.cargo,
      fecha_inicio: p.fechaInicio,
      fecha_fin: p.fechaFin,
      funciones: p.funciones,
      motivo_retiro: p.motivoRetiro,
      telefono_contacto: p.telefonoContacto,
      jefe_inmediato: p.jefeInmediato,
    };
  }
  protected withId(e: ExperienciaLaboral, id: number): ExperienciaLaboral {
    return e.withId(id);
  }
}

@Injectable()
export class TypeOrmDatosBasicosRepository extends DatosBasicosRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly users: Repository<UserOrmEntity>) {
    super();
  }

  async find(userId: number): Promise<DatosBasicos | null> {
    const u = await this.users.findOne({ where: { id: userId } });
    if (!u) return null;
    return {
      userId: u.id,
      firstName: u.first_name ?? '',
      lastName: u.last_name ?? '',
      email: u.email,
      cedula: u.cedula,
      codigoEmpresa: u.codigo_empresa,
      lugarExpedicionCedula: u.lugar_expedicion_cedula,
      fechaNacimiento: u.fecha_nacimiento,
      fechaIngreso: u.fecha_ingreso,
      direccion: u.direccion,
      telefono: u.telefono,
      celular: u.celular,
      genero: u.genero,
      estadoCivil: u.estado_civil,
      tipoSangre: u.tipo_sangre,
      eps: u.eps,
      arl: u.arl,
      fondoPension: u.fondo_pension,
      cajaCompensacion: u.caja_compensacion,
      numeroHijos: u.numero_hijos ?? 0,
    };
  }

  async update(userId: number, d: DatosBasicosProps): Promise<void> {
    await this.users.update(
      { id: userId },
      {
        direccion: d.direccion,
        telefono: d.telefono,
        celular: d.celular,
        genero: d.genero,
        estado_civil: d.estadoCivil,
        tipo_sangre: d.tipoSangre,
        eps: d.eps,
        arl: d.arl,
        fondo_pension: d.fondoPension,
        caja_compensacion: d.cajaCompensacion,
        numero_hijos: d.numeroHijos,
        updated_at: new Date(),
      },
    );
  }
}
