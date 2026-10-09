import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import {
  DatosBasicosDto,
  EducacionFormalDto,
  EducacionNoFormalDto,
  ExperienciaLaboralDto,
  FamiliarDto,
} from '../../application/dto/info-personal.dto';
import {
  DeleteEducacionFormalUseCase,
  DeleteEducacionNoFormalUseCase,
  DeleteExperienciaLaboralUseCase,
  DeleteFamiliarUseCase,
  GetDatosBasicosUseCase,
  ListEducacionFormalUseCase,
  ListEducacionNoFormalUseCase,
  ListExperienciaLaboralUseCase,
  ListFamiliaresUseCase,
  SaveEducacionFormalUseCase,
  SaveEducacionNoFormalUseCase,
  SaveExperienciaLaboralUseCase,
  SaveFamiliarUseCase,
  UpdateDatosBasicosUseCase,
} from '../../application/use-cases/info-personal.use-cases';
import {
  EducacionFormalRequestDto,
  EducacionNoFormalRequestDto,
  ExperienciaLaboralRequestDto,
  FamiliarRequestDto,
  UpdateDatosBasicosRequestDto,
  UserIdQueryDto,
} from './dto/info-personal-request.dto';

/** Cuerpo multipart de educación no formal (campos del DTO + archivo `certificado`). */
const CERTIFICADO_BODY = {
  schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['curso', 'diplomado', 'seminario', 'taller', 'certificacion', 'congreso'] },
      nombrePrograma: { type: 'string' },
      institucion: { type: 'string' },
      horas: { type: 'integer' },
      fecha: { type: 'string', example: '2024-03-10' },
      certificado: { type: 'string', format: 'binary', description: 'pdf/png/jpg, máx. 5 MB' },
    },
    required: ['tipo', 'nombrePrograma'],
  },
};

/**
 * Información personal del propio usuario (equivale a `controllers/InfoPersonal.php`).
 * Lectura: el admin puede consultar a otro usuario con `?userId=`. Escritura: siempre sobre el actor.
 */
@ApiTags('Información personal')
@ApiBearerAuth()
@Controller('info-personal')
export class InfoPersonalController {
  constructor(
    private readonly getDatos: GetDatosBasicosUseCase,
    private readonly updateDatos: UpdateDatosBasicosUseCase,
    private readonly listEdFormal: ListEducacionFormalUseCase,
    private readonly saveEdFormal: SaveEducacionFormalUseCase,
    private readonly deleteEdFormal: DeleteEducacionFormalUseCase,
    private readonly listEdNoFormal: ListEducacionNoFormalUseCase,
    private readonly saveEdNoFormal: SaveEducacionNoFormalUseCase,
    private readonly deleteEdNoFormal: DeleteEducacionNoFormalUseCase,
    private readonly listFamiliares: ListFamiliaresUseCase,
    private readonly saveFamiliar: SaveFamiliarUseCase,
    private readonly deleteFamiliar: DeleteFamiliarUseCase,
    private readonly listExperiencia: ListExperienciaLaboralUseCase,
    private readonly saveExperiencia: SaveExperienciaLaboralUseCase,
    private readonly deleteExperiencia: DeleteExperienciaLaboralUseCase,
  ) {}

  // ---------- Datos básicos ----------
  @Get('datos-basicos')
  @ApiOperation({ summary: 'Datos básicos del usuario (o de otro, si es admin)' })
  datosBasicos(@CurrentUser() actor: Actor, @Query() q: UserIdQueryDto): Promise<DatosBasicosDto> {
    return this.getDatos.execute({ actor, userId: q.userId });
  }

  @Put('datos-basicos')
  @ApiOperation({ summary: 'Actualizar los datos básicos propios' })
  guardarDatosBasicos(
    @CurrentUser() actor: Actor,
    @Body() dto: UpdateDatosBasicosRequestDto,
  ): Promise<DatosBasicosDto> {
    return this.updateDatos.execute({ actor, datos: nullify(dto) });
  }

  // ---------- Educación formal ----------
  @Get('educacion-formal')
  @ApiOperation({ summary: 'Listar educación formal' })
  educacionFormal(@CurrentUser() actor: Actor, @Query() q: UserIdQueryDto): Promise<EducacionFormalDto[]> {
    return this.listEdFormal.execute({ actor, userId: q.userId });
  }

  @Post('educacion-formal')
  @ApiOperation({ summary: 'Crear registro de educación formal' })
  crearEducacionFormal(
    @CurrentUser() actor: Actor,
    @Body() dto: EducacionFormalRequestDto,
  ): Promise<EducacionFormalDto> {
    return this.saveEdFormal.execute({ actor, data: nullify(dto) });
  }

  @Put('educacion-formal/:id')
  @ApiOperation({ summary: 'Actualizar registro de educación formal propio' })
  editarEducacionFormal(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EducacionFormalRequestDto,
  ): Promise<EducacionFormalDto> {
    return this.saveEdFormal.execute({ actor, id, data: nullify(dto) });
  }

  @Delete('educacion-formal/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar registro de educación formal propio' })
  eliminarEducacionFormal(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteEdFormal.execute({ actor, id });
  }

  // ---------- Educación no formal ----------
  @Get('educacion-no-formal')
  @ApiOperation({ summary: 'Listar educación no formal' })
  educacionNoFormal(@CurrentUser() actor: Actor, @Query() q: UserIdQueryDto): Promise<EducacionNoFormalDto[]> {
    return this.listEdNoFormal.execute({ actor, userId: q.userId });
  }

  @Post('educacion-no-formal')
  @UseInterceptors(FileInterceptor('certificado'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CERTIFICADO_BODY)
  @ApiOperation({ summary: 'Crear registro de educación no formal (con certificado opcional)' })
  crearEducacionNoFormal(
    @CurrentUser() actor: Actor,
    @Body() dto: EducacionNoFormalRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EducacionNoFormalDto> {
    return this.saveEdNoFormal.execute({ actor, data: nullify(dto), certificado: toUpload(file) });
  }

  @Put('educacion-no-formal/:id')
  @UseInterceptors(FileInterceptor('certificado'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(CERTIFICADO_BODY)
  @ApiOperation({ summary: 'Actualizar registro de educación no formal propio' })
  editarEducacionNoFormal(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EducacionNoFormalRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EducacionNoFormalDto> {
    return this.saveEdNoFormal.execute({ actor, id, data: nullify(dto), certificado: toUpload(file) });
  }

  @Delete('educacion-no-formal/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar registro de educación no formal propio' })
  eliminarEducacionNoFormal(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteEdNoFormal.execute({ actor, id });
  }

  // ---------- Familiares ----------
  @Get('familiares')
  @ApiOperation({ summary: 'Listar familiares' })
  familiares(@CurrentUser() actor: Actor, @Query() q: UserIdQueryDto): Promise<FamiliarDto[]> {
    return this.listFamiliares.execute({ actor, userId: q.userId });
  }

  @Post('familiares')
  @ApiOperation({ summary: 'Crear familiar' })
  crearFamiliar(@CurrentUser() actor: Actor, @Body() dto: FamiliarRequestDto): Promise<FamiliarDto> {
    return this.saveFamiliar.execute({ actor, data: { ...nullify(dto), dependiente: dto.dependiente === true } });
  }

  @Put('familiares/:id')
  @ApiOperation({ summary: 'Actualizar familiar propio' })
  editarFamiliar(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FamiliarRequestDto,
  ): Promise<FamiliarDto> {
    return this.saveFamiliar.execute({ actor, id, data: { ...nullify(dto), dependiente: dto.dependiente === true } });
  }

  @Delete('familiares/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar familiar propio' })
  eliminarFamiliar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteFamiliar.execute({ actor, id });
  }

  // ---------- Experiencia laboral ----------
  @Get('experiencia')
  @ApiOperation({ summary: 'Listar experiencia laboral' })
  experiencia(@CurrentUser() actor: Actor, @Query() q: UserIdQueryDto): Promise<ExperienciaLaboralDto[]> {
    return this.listExperiencia.execute({ actor, userId: q.userId });
  }

  @Post('experiencia')
  @ApiOperation({ summary: 'Crear experiencia laboral' })
  crearExperiencia(
    @CurrentUser() actor: Actor,
    @Body() dto: ExperienciaLaboralRequestDto,
  ): Promise<ExperienciaLaboralDto> {
    return this.saveExperiencia.execute({ actor, data: nullify(dto) });
  }

  @Put('experiencia/:id')
  @ApiOperation({ summary: 'Actualizar experiencia laboral propia' })
  editarExperiencia(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExperienciaLaboralRequestDto,
  ): Promise<ExperienciaLaboralDto> {
    return this.saveExperiencia.execute({ actor, id, data: nullify(dto) });
  }

  @Delete('experiencia/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar experiencia laboral propia' })
  eliminarExperiencia(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteExperiencia.execute({ actor, id });
  }
}

/** Convierte los opcionales ausentes (`undefined`) en `null`, que es lo que esperan los casos de uso. */
function nullify<T extends object>(dto: T): { [K in keyof T]-?: Exclude<T[K], undefined> | null } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dto)) out[k] = v === undefined ? null : v;
  return out as { [K in keyof T]-?: Exclude<T[K], undefined> | null };
}

function toUpload(file?: Express.Multer.File) {
  return file ? { content: file.buffer, originalName: file.originalname, mimeType: file.mimetype } : null;
}
