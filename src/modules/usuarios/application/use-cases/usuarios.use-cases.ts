import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { TokenGenerator } from '../../../../shared/application/ports/token-generator.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import {
  ConflictError,
  InvalidOperationError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/domain-error';
import { isUserRole, UserRole } from '../../../../shared/domain/user-role';
import { Usuario } from '../../domain/usuario';
import { PuntosInicializador, UsuarioConCatalogos, UsuarioRepository } from '../../domain/usuario.repository';
import {
  CreateUsuarioInput,
  PasswordRestablecidaDto,
  ResetPasswordUsuarioInput,
  UpdateUsuarioInput,
  UsuarioCreadoDto,
  UsuarioDto,
} from '../dto/usuarios.dto';

export const MIN_PASSWORD_LENGTH = 8;

export function toUsuarioDto(row: UsuarioConCatalogos): UsuarioDto {
  const p = row.usuario.props;
  return {
    id: p.id ?? 0,
    username: p.username,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    nombreCompleto: row.usuario.nombreCompleto,
    role: p.role,
    sedeId: p.sedeId,
    sedeNombre: row.sedeNombre,
    areaId: p.areaId,
    areaNombre: row.areaNombre,
    cargoId: p.cargoId,
    cargoNombre: row.cargoNombre,
    estadoColaborador: p.estadoColaborador,
    profileImage: p.profileImage,
  };
}

/** Igual que el legado: un rol desconocido se trata como `funcionario`. */
function normalizeRole(role: string): UserRole {
  return isUserRole(role) ? role : 'funcionario';
}

@Injectable()
export class ListUsuariosUseCase implements UseCase<void, UsuarioDto[]> {
  constructor(private readonly usuarios: UsuarioRepository) {}
  async execute(): Promise<UsuarioDto[]> {
    return (await this.usuarios.findAll()).map(toUsuarioDto);
  }
}

@Injectable()
export class GetUsuarioUseCase implements UseCase<number, UsuarioDto> {
  constructor(private readonly usuarios: UsuarioRepository) {}
  async execute(id: number): Promise<UsuarioDto> {
    const row = await this.usuarios.findById(id);
    if (!row) throw new NotFoundError('Usuario', id);
    return toUsuarioDto(row);
  }
}

@Injectable()
export class CreateUsuarioUseCase implements UseCase<CreateUsuarioInput, UsuarioCreadoDto> {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly puntos: PuntosInicializador,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: CreateUsuarioInput): Promise<UsuarioCreadoDto> {
    const usuario = Usuario.create({
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: normalizeRole(input.role),
      sedeId: input.sedeId,
      areaId: input.areaId,
      cargoId: input.cargoId,
    });
    if (await this.usuarios.existsByUsername(usuario.username)) {
      throw new ConflictError(`El nombre de usuario "${usuario.username}" ya está en uso.`);
    }
    if (await this.usuarios.existsByEmail(usuario.email)) {
      throw new ConflictError(`El correo "${usuario.email}" ya está registrado.`);
    }

    const provided = (input.password ?? '').trim();
    if (provided !== '' && provided.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    const generated = provided === '';
    const plain = generated ? this.tokens.temporaryPassword() : provided;

    const creado = await this.usuarios.create(usuario, await this.hasher.hash(plain));
    await this.puntos.inicializar(creado.id as number);

    const row = (await this.usuarios.findById(creado.id as number)) ?? {
      usuario: creado,
      sedeNombre: null,
      areaNombre: null,
      cargoNombre: null,
    };
    return { ...toUsuarioDto(row), temporaryPassword: generated ? plain : null };
  }
}

@Injectable()
export class UpdateUsuarioUseCase implements UseCase<UpdateUsuarioInput, UsuarioDto> {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async execute(input: UpdateUsuarioInput): Promise<UsuarioDto> {
    const existente = await this.usuarios.findById(input.id);
    if (!existente) throw new NotFoundError('Usuario', input.id);

    const actualizado = existente.usuario.actualizar({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: normalizeRole(input.role),
      sedeId: input.sedeId,
      areaId: input.areaId,
      cargoId: input.cargoId,
    });
    if (await this.usuarios.existsByEmail(actualizado.email, input.id)) {
      throw new ConflictError(`El correo "${actualizado.email}" ya está registrado por otro usuario.`);
    }
    await this.usuarios.update(actualizado);
    const row = await this.usuarios.findById(input.id);
    return toUsuarioDto(row ?? { ...existente, usuario: actualizado });
  }
}

@Injectable()
export class ResetPasswordUsuarioUseCase implements UseCase<ResetPasswordUsuarioInput, PasswordRestablecidaDto> {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: ResetPasswordUsuarioInput): Promise<PasswordRestablecidaDto> {
    const existente = await this.usuarios.findById(input.id);
    if (!existente) throw new NotFoundError('Usuario', input.id);

    const provided = (input.newPassword ?? '').trim();
    const generated = provided === '';
    if (!generated && provided.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    const plain = generated ? this.tokens.temporaryPassword() : provided;
    await this.usuarios.updatePasswordHash(input.id, await this.hasher.hash(plain));
    return {
      temporaryPassword: generated ? plain : null,
      message: generated
        ? 'Contraseña restablecida. Anota la contraseña temporal y entrégala; no se volverá a mostrar.'
        : 'Contraseña restablecida.',
    };
  }
}

@Injectable()
export class DeleteUsuarioUseCase implements UseCase<{ id: number; actor: Actor }, void> {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async execute(input: { id: number; actor: Actor }): Promise<void> {
    if (input.id === input.actor.id) {
      throw new InvalidOperationError('No puedes eliminar tu propio usuario.');
    }
    const existente = await this.usuarios.findById(input.id);
    if (!existente) throw new NotFoundError('Usuario', input.id);
    await this.usuarios.delete(input.id);
  }
}
