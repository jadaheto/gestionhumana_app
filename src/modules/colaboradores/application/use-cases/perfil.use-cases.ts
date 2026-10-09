import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { PasswordHasher } from '../../../../shared/application/ports/password-hasher.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../../../shared/domain/domain-error';
import { ColaboradorRepository } from '../../domain/colaborador.repository';
import {
  ExperienceItem,
  normalizeExperience,
  normalizePerfilDatos,
  normalizePrivacySettings,
  Perfil,
  PerfilRepository,
  PrivacySettings,
  validateNewPassword,
} from '../../domain/perfil';
import { LoginHistoryReader } from '../../domain/ports';
import {
  ChangePasswordInput,
  PerfilCompletoDto,
  PerfilDto,
  UpdateExperienceInput,
  UpdatePerfilInput,
  UpdatePortafolioInput,
  UpdatePrivacySettingsInput,
  UploadPerfilImageInput,
} from '../dto/perfil.dto';
import { PROFILE_IMAGE_EXTENSIONS } from './colaboradores.use-cases';

/** Tamaño máximo de las imágenes de perfil/portada (2 MB). */
export const PERFIL_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const LOGIN_HISTORY_LIMIT = 5;

export function toPerfilDto(p: Perfil): PerfilDto {
  return { ...p.props, fullName: p.fullName, completionPct: p.completionPct };
}

async function loadPerfil(repo: PerfilRepository, actor: Actor): Promise<Perfil> {
  const perfil = await repo.findById(actor.id);
  if (!perfil) throw new NotFoundError('Usuario', actor.id);
  return perfil;
}

@Injectable()
export class GetPerfilUseCase implements UseCase<Actor, PerfilCompletoDto> {
  constructor(
    private readonly perfiles: PerfilRepository,
    private readonly loginHistory: LoginHistoryReader,
  ) {}
  async execute(actor: Actor): Promise<PerfilCompletoDto> {
    const perfil = await loadPerfil(this.perfiles, actor);
    const history = await this.loginHistory.findRecent(actor.id, LOGIN_HISTORY_LIMIT);
    return { ...toPerfilDto(perfil), loginHistory: history };
  }
}

@Injectable()
export class UpdatePerfilUseCase implements UseCase<UpdatePerfilInput, PerfilDto> {
  constructor(
    private readonly perfiles: PerfilRepository,
    private readonly colaboradores: ColaboradorRepository,
  ) {}
  async execute(input: UpdatePerfilInput): Promise<PerfilDto> {
    await loadPerfil(this.perfiles, input.actor);
    const datos = normalizePerfilDatos(input.datos);
    if (await this.colaboradores.existsEmail(datos.email, input.actor.id)) {
      throw new ConflictError('El correo electrónico ya está registrado por otro usuario.');
    }
    await this.perfiles.updateDatos(input.actor.id, datos);
    return toPerfilDto(await loadPerfil(this.perfiles, input.actor));
  }
}

@Injectable()
export class UpdatePortafolioUseCase implements UseCase<UpdatePortafolioInput, PerfilDto> {
  constructor(private readonly perfiles: PerfilRepository) {}
  async execute(input: UpdatePortafolioInput): Promise<PerfilDto> {
    await loadPerfil(this.perfiles, input.actor);
    const p = input.portafolio;
    await this.perfiles.updatePortafolio(input.actor.id, {
      githubUsername: p.githubUsername?.trim() || null,
      website: p.website?.trim() || null,
      dribbbleUsername: p.dribbbleUsername?.trim() || null,
      pinterestUsername: p.pinterestUsername?.trim() || null,
    });
    return toPerfilDto(await loadPerfil(this.perfiles, input.actor));
  }
}

@Injectable()
export class UploadPerfilImageUseCase implements UseCase<UploadPerfilImageInput, PerfilDto> {
  constructor(
    private readonly perfiles: PerfilRepository,
    private readonly files: FileStorage,
  ) {}
  async execute(input: UploadPerfilImageInput): Promise<PerfilDto> {
    await loadPerfil(this.perfiles, input.actor);
    const stored = await this.files.save(input.content, {
      folder: 'profile',
      originalName: input.originalName,
      mimeType: input.mimeType,
      allowedExtensions: PROFILE_IMAGE_EXTENSIONS,
      maxBytes: PERFIL_IMAGE_MAX_BYTES,
    });
    await this.perfiles.updateImage(input.actor.id, input.kind, stored.relativePath);
    return toPerfilDto(await loadPerfil(this.perfiles, input.actor));
  }
}

@Injectable()
export class ChangePasswordUseCase implements UseCase<ChangePasswordInput, void> {
  constructor(
    private readonly perfiles: PerfilRepository,
    private readonly hasher: PasswordHasher,
  ) {}
  async execute(input: ChangePasswordInput): Promise<void> {
    const hash = await this.perfiles.findPasswordHash(input.actor.id);
    if (!hash || !(await this.hasher.compare(input.oldPassword, hash))) {
      throw new UnauthorizedError('La contraseña actual es incorrecta.');
    }
    validateNewPassword(input.newPassword, input.confirmPassword);
    await this.perfiles.updatePassword(input.actor.id, await this.hasher.hash(input.newPassword));
  }
}

@Injectable()
export class UpdatePrivacySettingsUseCase implements UseCase<UpdatePrivacySettingsInput, PrivacySettings> {
  constructor(private readonly perfiles: PerfilRepository) {}
  async execute(input: UpdatePrivacySettingsInput): Promise<PrivacySettings> {
    await loadPerfil(this.perfiles, input.actor);
    const settings = normalizePrivacySettings(input.settings);
    await this.perfiles.updatePrivacySettings(input.actor.id, settings);
    return settings;
  }
}

@Injectable()
export class UpdateExperienceUseCase implements UseCase<UpdateExperienceInput, ExperienceItem[]> {
  constructor(private readonly perfiles: PerfilRepository) {}
  async execute(input: UpdateExperienceInput): Promise<ExperienceItem[]> {
    await loadPerfil(this.perfiles, input.actor);
    const experience = normalizeExperience(input.experience);
    await this.perfiles.updateExperience(input.actor.id, experience);
    return experience;
  }
}
