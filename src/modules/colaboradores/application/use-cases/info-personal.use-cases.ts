import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import {
  DatosBasicosRepository,
  EducacionFormal,
  EducacionFormalRepository,
  EducacionNoFormal,
  EducacionNoFormalRepository,
  ExperienciaLaboral,
  ExperienciaLaboralRepository,
  Familiar,
  FamiliarRepository,
  normalizeDatosBasicos,
  OwnedRecord,
  OwnedRecordRepository,
} from '../../domain/info-personal';
import {
  DatosBasicosDto,
  DeleteOwnedInput,
  EducacionFormalDto,
  EducacionNoFormalDto,
  ExperienciaLaboralDto,
  FamiliarDto,
  OwnedQueryInput,
  SaveEducacionFormalInput,
  SaveEducacionNoFormalInput,
  SaveExperienciaLaboralInput,
  SaveFamiliarInput,
  UpdateDatosBasicosInput,
} from '../dto/info-personal.dto';

/** Carpeta de `uploads` para certificados de educación no formal. */
export const CERTIFICADOS_EDUCACION_FOLDER = 'certificados';
export const CERTIFICADO_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
export const CERTIFICADO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Resuelve a qué usuario pertenece la consulta: el propio actor, o cualquiera
 * si el actor es administrador. Un funcionario nunca puede ver a otro.
 */
export function resolveTargetUser(actor: Actor, userId?: number): number {
  if (userId === undefined || userId === actor.id) return actor.id;
  if (!isAdmin(actor)) throw new ForbiddenError('Sólo puedes consultar tu propia información personal.');
  return userId;
}

function toDto<T extends OwnedRecord>(record: { props: T }): Omit<T, 'id'> & { id: number } {
  return { ...record.props, id: record.props.id ?? 0 };
}

// ---------- Datos básicos ----------
@Injectable()
export class GetDatosBasicosUseCase implements UseCase<OwnedQueryInput, DatosBasicosDto> {
  constructor(private readonly repo: DatosBasicosRepository) {}
  async execute(input: OwnedQueryInput): Promise<DatosBasicosDto> {
    const userId = resolveTargetUser(input.actor, input.userId);
    const datos = await this.repo.find(userId);
    if (!datos) throw new NotFoundError('Usuario', userId);
    return datos;
  }
}

@Injectable()
export class UpdateDatosBasicosUseCase implements UseCase<UpdateDatosBasicosInput, DatosBasicosDto> {
  constructor(private readonly repo: DatosBasicosRepository) {}
  async execute(input: UpdateDatosBasicosInput): Promise<DatosBasicosDto> {
    const current = await this.repo.find(input.actor.id);
    if (!current) throw new NotFoundError('Usuario', input.actor.id);
    // ARL y caja de compensación las asigna la empresa: un colaborador no puede cambiarlas.
    const datos = isAdmin(input.actor)
      ? input.datos
      : { ...input.datos, arl: current.arl, cajaCompensacion: current.cajaCompensacion };
    await this.repo.update(input.actor.id, normalizeDatosBasicos(datos));
    return (await this.repo.find(input.actor.id)) as DatosBasicosDto;
  }
}

// ---------- Base genérica para colecciones propias ----------
abstract class ListOwnedUseCase<T extends OwnedRecord & { props: P }, P extends OwnedRecord> implements UseCase<
  OwnedQueryInput,
  Array<Omit<P, 'id'> & { id: number }>
> {
  protected constructor(private readonly repo: OwnedRecordRepository<T>) {}
  async execute(input: OwnedQueryInput): Promise<Array<Omit<P, 'id'> & { id: number }>> {
    const userId = resolveTargetUser(input.actor, input.userId);
    return (await this.repo.findByUser(userId)).map((r) => toDto<P>(r));
  }
}

abstract class DeleteOwnedUseCase<T extends OwnedRecord> implements UseCase<DeleteOwnedInput, void> {
  protected constructor(
    private readonly repo: OwnedRecordRepository<T>,
    private readonly entity: string,
  ) {}
  async execute(input: DeleteOwnedInput): Promise<void> {
    // Evita IDOR: sólo se eliminan registros del propio usuario.
    if (!(await this.repo.findOne(input.id, input.actor.id))) throw new NotFoundError(this.entity, input.id);
    await this.repo.delete(input.id, input.actor.id);
  }
}

async function assertOwned<T extends OwnedRecord>(
  repo: OwnedRecordRepository<T>,
  id: number | undefined,
  userId: number,
  entity: string,
): Promise<void> {
  if (id !== undefined && !(await repo.findOne(id, userId))) throw new NotFoundError(entity, id);
}

// ---------- Educación formal ----------
@Injectable()
export class ListEducacionFormalUseCase extends ListOwnedUseCase<EducacionFormal, EducacionFormal['props']> {
  constructor(repo: EducacionFormalRepository) {
    super(repo);
  }
}

@Injectable()
export class SaveEducacionFormalUseCase implements UseCase<SaveEducacionFormalInput, EducacionFormalDto> {
  constructor(private readonly repo: EducacionFormalRepository) {}
  async execute(input: SaveEducacionFormalInput): Promise<EducacionFormalDto> {
    await assertOwned(this.repo, input.id, input.actor.id, 'Educación formal');
    const record = EducacionFormal.create({ ...input.data, id: input.id ?? null, userId: input.actor.id });
    return toDto(input.id ? await this.repo.update(record) : await this.repo.insert(record));
  }
}

@Injectable()
export class DeleteEducacionFormalUseCase extends DeleteOwnedUseCase<EducacionFormal> {
  constructor(repo: EducacionFormalRepository) {
    super(repo, 'Educación formal');
  }
}

// ---------- Educación no formal ----------
@Injectable()
export class ListEducacionNoFormalUseCase extends ListOwnedUseCase<EducacionNoFormal, EducacionNoFormal['props']> {
  constructor(repo: EducacionNoFormalRepository) {
    super(repo);
  }
}

@Injectable()
export class SaveEducacionNoFormalUseCase implements UseCase<SaveEducacionNoFormalInput, EducacionNoFormalDto> {
  constructor(
    private readonly repo: EducacionNoFormalRepository,
    private readonly files: FileStorage,
  ) {}
  async execute(input: SaveEducacionNoFormalInput): Promise<EducacionNoFormalDto> {
    const existing = input.id ? await this.repo.findOne(input.id, input.actor.id) : null;
    if (input.id && !existing) throw new NotFoundError('Educación no formal', input.id);
    let record = EducacionNoFormal.create({
      ...input.data,
      id: input.id ?? null,
      userId: input.actor.id,
      certificado: existing?.props.certificado ?? null,
    });
    if (input.certificado) {
      const stored = await this.files.save(input.certificado.content, {
        folder: CERTIFICADOS_EDUCACION_FOLDER,
        originalName: input.certificado.originalName,
        mimeType: input.certificado.mimeType,
        allowedExtensions: CERTIFICADO_EXTENSIONS,
        maxBytes: CERTIFICADO_MAX_BYTES,
      });
      if (existing?.props.certificado) await this.files.delete(existing.props.certificado);
      record = record.withCertificado(stored.relativePath);
    }
    return toDto(input.id ? await this.repo.update(record) : await this.repo.insert(record));
  }
}

@Injectable()
export class DeleteEducacionNoFormalUseCase implements UseCase<DeleteOwnedInput, void> {
  constructor(
    private readonly repo: EducacionNoFormalRepository,
    private readonly files: FileStorage,
  ) {}
  async execute(input: DeleteOwnedInput): Promise<void> {
    const existing = await this.repo.findOne(input.id, input.actor.id);
    if (!existing) throw new NotFoundError('Educación no formal', input.id);
    await this.repo.delete(input.id, input.actor.id);
    if (existing.props.certificado) await this.files.delete(existing.props.certificado);
  }
}

// ---------- Familiares ----------
@Injectable()
export class ListFamiliaresUseCase extends ListOwnedUseCase<Familiar, Familiar['props']> {
  constructor(repo: FamiliarRepository) {
    super(repo);
  }
}

@Injectable()
export class SaveFamiliarUseCase implements UseCase<SaveFamiliarInput, FamiliarDto> {
  constructor(private readonly repo: FamiliarRepository) {}
  async execute(input: SaveFamiliarInput): Promise<FamiliarDto> {
    await assertOwned(this.repo, input.id, input.actor.id, 'Familiar');
    const record = Familiar.create({ ...input.data, id: input.id ?? null, userId: input.actor.id });
    return toDto(input.id ? await this.repo.update(record) : await this.repo.insert(record));
  }
}

@Injectable()
export class DeleteFamiliarUseCase extends DeleteOwnedUseCase<Familiar> {
  constructor(repo: FamiliarRepository) {
    super(repo, 'Familiar');
  }
}

// ---------- Experiencia laboral ----------
@Injectable()
export class ListExperienciaLaboralUseCase extends ListOwnedUseCase<ExperienciaLaboral, ExperienciaLaboral['props']> {
  constructor(repo: ExperienciaLaboralRepository) {
    super(repo);
  }
}

@Injectable()
export class SaveExperienciaLaboralUseCase implements UseCase<SaveExperienciaLaboralInput, ExperienciaLaboralDto> {
  constructor(private readonly repo: ExperienciaLaboralRepository) {}
  async execute(input: SaveExperienciaLaboralInput): Promise<ExperienciaLaboralDto> {
    await assertOwned(this.repo, input.id, input.actor.id, 'Experiencia laboral');
    const record = ExperienciaLaboral.create({ ...input.data, id: input.id ?? null, userId: input.actor.id });
    return toDto(input.id ? await this.repo.update(record) : await this.repo.insert(record));
  }
}

@Injectable()
export class DeleteExperienciaLaboralUseCase extends DeleteOwnedUseCase<ExperienciaLaboral> {
  constructor(repo: ExperienciaLaboralRepository) {
    super(repo, 'Experiencia laboral');
  }
}
