import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { TokenGenerator } from '../../../../shared/application/ports/token-generator.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ConflictError, InvalidOperationError, NotFoundError } from '../../../../shared/domain/domain-error';
import { Colaborador, generateUsername } from '../../domain/colaborador';
import { ColaboradorConNombres, ColaboradorRepository } from '../../domain/colaborador.repository';
import { ContratoActivoReader } from '../../domain/ports';
import {
  ColaboradorCreadoDto,
  ColaboradorDetalleDto,
  ColaboradorDto,
  ColaboradorListadoDto,
  DeleteColaboradorInput,
  ListColaboradoresInput,
  SaveColaboradorInput,
  UploadFotoColaboradorInput,
} from '../dto/colaboradores.dto';

export const PROFILE_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];
/** Límite del legado para la foto del colaborador (5 MB). */
export const COLABORADOR_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function toColaboradorDto(c: Colaborador): ColaboradorDto {
  const p = c.props;
  return {
    id: p.id ?? 0,
    username: p.username,
    email: p.email,
    role: p.role,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: c.fullName,
    cedula: p.cedula,
    codigoEmpresa: p.codigoEmpresa,
    phoneNumber: p.phoneNumber,
    telefono: p.telefono,
    celular: p.celular,
    sedeId: p.sedeId,
    areaId: p.areaId,
    cargoId: p.cargoId,
    estadoColaborador: p.estadoColaborador,
    fechaNacimiento: p.fechaNacimiento,
    fechaIngreso: p.fechaIngreso,
    genero: p.genero,
    estadoCivil: p.estadoCivil,
    direccion: p.direccion,
    eps: p.eps,
    arl: p.arl,
    fondoPension: p.fondoPension,
    cajaCompensacion: p.cajaCompensacion,
    tipoSangre: p.tipoSangre,
    designation: p.designation,
    profileImage: p.profileImage,
    numeroHijos: p.numeroHijos,
  };
}

export function toColaboradorListadoDto(r: ColaboradorConNombres): ColaboradorListadoDto {
  return {
    ...toColaboradorDto(r.colaborador),
    sedeNombre: r.sedeNombre,
    areaNombre: r.areaNombre,
    cargoNombre: r.cargoNombre,
  };
}

/** Comprueba unicidad de correo, cédula y código de empresa (mismos mensajes que el legado). */
async function assertUnique(repo: ColaboradorRepository, c: Colaborador, excludeId?: number): Promise<void> {
  if (await repo.existsEmail(c.props.email, excludeId)) {
    throw new ConflictError('El correo electrónico ya está registrado. Verifica y usa otro correo.');
  }
  if (await repo.existsCedula(c.props.cedula, excludeId)) {
    throw new ConflictError('La cédula ya está registrada en otro colaborador.');
  }
  if (c.props.codigoEmpresa && (await repo.existsCodigoEmpresa(c.props.codigoEmpresa, excludeId))) {
    throw new ConflictError('El código de empresa ya está registrado en otro colaborador.');
  }
}

@Injectable()
export class ListColaboradoresUseCase implements UseCase<ListColaboradoresInput, ColaboradorListadoDto[]> {
  constructor(private readonly colaboradores: ColaboradorRepository) {}
  async execute(input: ListColaboradoresInput): Promise<ColaboradorListadoDto[]> {
    const rows = await this.colaboradores.findAll({ estado: input.estado, areaId: input.areaId, sedeId: input.sedeId });
    return rows.map(toColaboradorListadoDto);
  }
}

@Injectable()
export class GetColaboradorUseCase implements UseCase<number, ColaboradorDetalleDto> {
  constructor(
    private readonly colaboradores: ColaboradorRepository,
    private readonly contratos: ContratoActivoReader,
  ) {}
  async execute(id: number): Promise<ColaboradorDetalleDto> {
    const row = await this.colaboradores.findDetalle(id);
    if (!row) throw new NotFoundError('Colaborador', id);
    const contratoActivo = await this.contratos.findActivo(id);
    return { ...toColaboradorListadoDto(row), cargoFunciones: row.cargoFunciones, contratoActivo };
  }
}

@Injectable()
export class CreateColaboradorUseCase implements UseCase<SaveColaboradorInput, ColaboradorCreadoDto> {
  constructor(
    private readonly colaboradores: ColaboradorRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: SaveColaboradorInput): Promise<ColaboradorCreadoDto> {
    let colaborador = Colaborador.create({ ...input, role: 'funcionario' });
    await assertUnique(this.colaboradores, colaborador);

    const requestedUsername = (input.username ?? '').trim().toLowerCase();
    if (requestedUsername !== '') {
      if (await this.colaboradores.existsUsername(requestedUsername)) {
        throw new ConflictError('El nombre de usuario ya está en uso.');
      }
      colaborador = colaborador.withUsername(requestedUsername);
    } else {
      colaborador = colaborador.withUsername(await this.uniqueUsername(colaborador));
    }

    const temporaryPassword = (input.password ?? '').trim() === '' ? this.tokens.temporaryPassword() : null;
    const plain = temporaryPassword ?? (input.password as string);
    const created = await this.colaboradores.create(colaborador, await this.hasher.hash(plain));
    return { colaborador: toColaboradorDto(created), username: created.props.username, temporaryPassword };
  }

  /** Igual que el legado: añade un contador hasta que el usuario sea único. */
  private async uniqueUsername(c: Colaborador): Promise<string> {
    const base = generateUsername(c.props.firstName, c.props.lastName);
    let username = base;
    let counter = 1;
    while (await this.colaboradores.existsUsername(username)) {
      username = `${base}${counter++}`;
    }
    return username;
  }
}

@Injectable()
export class UpdateColaboradorUseCase implements UseCase<SaveColaboradorInput & { id: number }, ColaboradorDto> {
  constructor(private readonly colaboradores: ColaboradorRepository) {}

  async execute(input: SaveColaboradorInput & { id: number }): Promise<ColaboradorDto> {
    const existing = await this.colaboradores.findById(input.id);
    if (!existing) throw new NotFoundError('Colaborador', input.id);
    const updated = Colaborador.create({ ...input, id: input.id }).mergeFrom(existing);
    await assertUnique(this.colaboradores, updated, input.id);
    await this.colaboradores.update(updated);
    return toColaboradorDto(updated);
  }
}

@Injectable()
export class UploadFotoColaboradorUseCase implements UseCase<UploadFotoColaboradorInput, ColaboradorDto> {
  constructor(
    private readonly colaboradores: ColaboradorRepository,
    private readonly files: FileStorage,
  ) {}

  async execute(input: UploadFotoColaboradorInput): Promise<ColaboradorDto> {
    const existing = await this.colaboradores.findById(input.id);
    if (!existing) throw new NotFoundError('Colaborador', input.id);
    const stored = await this.files.save(input.content, {
      folder: 'profile',
      originalName: input.originalName,
      mimeType: input.mimeType,
      allowedExtensions: PROFILE_IMAGE_EXTENSIONS,
      maxBytes: COLABORADOR_PHOTO_MAX_BYTES,
    });
    await this.colaboradores.updateProfileImage(input.id, stored.relativePath);
    return toColaboradorDto(Colaborador.create({ ...existing.props, profileImage: stored.relativePath }));
  }
}

@Injectable()
export class DeleteColaboradorUseCase implements UseCase<DeleteColaboradorInput, void> {
  constructor(private readonly colaboradores: ColaboradorRepository) {}

  async execute(input: DeleteColaboradorInput): Promise<void> {
    if (input.actor.id === input.id) {
      throw new InvalidOperationError('No puedes eliminar tu propio usuario.');
    }
    if (!(await this.colaboradores.findById(input.id))) throw new NotFoundError('Colaborador', input.id);
    await this.colaboradores.delete(input.id);
  }
}
