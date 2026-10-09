import { Body, Controller, Get, HttpCode, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { PerfilCompletoDto, PerfilDto, PrivacySettingsDto } from '../../application/dto/perfil.dto';
import {
  ChangePasswordUseCase,
  GetPerfilUseCase,
  UpdateExperienceUseCase,
  UpdatePerfilUseCase,
  UpdatePortafolioUseCase,
  UpdatePrivacySettingsUseCase,
  UploadPerfilImageUseCase,
} from '../../application/use-cases/perfil.use-cases';
import { ExperienceItem } from '../../domain/perfil';
import {
  ChangePasswordRequestDto,
  PrivacySettingsRequestDto,
  UpdateExperienceRequestDto,
  UpdatePerfilRequestDto,
  UpdatePortafolioRequestDto,
} from './dto/perfil-request.dto';

const IMAGE_BODY = { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } };

/** Perfil del usuario autenticado (equivale a `controllers/Profile.php`). */
@ApiTags('Perfil')
@ApiBearerAuth()
@Controller('perfil')
export class PerfilController {
  constructor(
    private readonly getPerfil: GetPerfilUseCase,
    private readonly updatePerfil: UpdatePerfilUseCase,
    private readonly updatePortafolio: UpdatePortafolioUseCase,
    private readonly uploadImage: UploadPerfilImageUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly updatePrivacy: UpdatePrivacySettingsUseCase,
    private readonly updateExperience: UpdateExperienceUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Perfil propio con historial de inicio de sesión reciente' })
  perfil(@CurrentUser() actor: Actor): Promise<PerfilCompletoDto> {
    return this.getPerfil.execute(actor);
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar datos personales del perfil' })
  actualizar(@CurrentUser() actor: Actor, @Body() dto: UpdatePerfilRequestDto): Promise<PerfilDto> {
    return this.updatePerfil.execute({
      actor,
      datos: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber ?? null,
        designation: dto.designation ?? null,
        website: dto.website ?? null,
        city: dto.city ?? null,
        country: dto.country ?? null,
        zipCode: dto.zipCode ?? null,
        description: dto.description ?? null,
        skills: dto.skills ?? [],
        joiningDate: dto.joiningDate ?? null,
      },
    });
  }

  @Put('portafolio')
  @ApiOperation({ summary: 'Actualizar enlaces del portafolio' })
  portafolio(@CurrentUser() actor: Actor, @Body() dto: UpdatePortafolioRequestDto): Promise<PerfilDto> {
    return this.updatePortafolio.execute({
      actor,
      portafolio: {
        githubUsername: dto.githubUsername ?? null,
        website: dto.website ?? null,
        dribbbleUsername: dto.dribbbleUsername ?? null,
        pinterestUsername: dto.pinterestUsername ?? null,
      },
    });
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_BODY)
  @ApiOperation({ summary: 'Subir imagen de perfil (png/jpg/jpeg/gif, máx. 2 MB)' })
  foto(@CurrentUser() actor: Actor, @UploadedFile() file?: Express.Multer.File): Promise<PerfilDto> {
    return this.uploadImage.execute({ actor, kind: 'profile', ...requireFile(file) });
  }

  @Post('portada')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_BODY)
  @ApiOperation({ summary: 'Subir imagen de portada (png/jpg/jpeg/gif, máx. 2 MB)' })
  portada(@CurrentUser() actor: Actor, @UploadedFile() file?: Express.Multer.File): Promise<PerfilDto> {
    return this.uploadImage.execute({ actor, kind: 'cover', ...requireFile(file) });
  }

  @Put('password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambiar la contraseña (verifica la actual)' })
  async password(@CurrentUser() actor: Actor, @Body() dto: ChangePasswordRequestDto): Promise<{ message: string }> {
    await this.changePassword.execute({ actor, ...dto });
    return { message: '¡Contraseña actualizada correctamente!' };
  }

  @Put('privacidad')
  @ApiOperation({ summary: 'Guardar configuración de privacidad/notificaciones' })
  privacidad(@CurrentUser() actor: Actor, @Body() dto: PrivacySettingsRequestDto): Promise<PrivacySettingsDto> {
    return this.updatePrivacy.execute({ actor, settings: { ...dto } });
  }

  @Put('experiencia')
  @ApiOperation({ summary: 'Guardar la experiencia del perfil (JSON)' })
  experiencia(@CurrentUser() actor: Actor, @Body() dto: UpdateExperienceRequestDto): Promise<ExperienceItem[]> {
    return this.updateExperience.execute({ actor, experience: dto.experience });
  }
}

function requireFile(file?: Express.Multer.File) {
  if (!file) throw new ValidationError('Debes adjuntar una imagen.');
  return { content: file.buffer, originalName: file.originalname, mimeType: file.mimetype };
}
