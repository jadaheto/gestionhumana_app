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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { ArchivoSubido, ComunicadoDto, ComunicadoOperacionDto } from '../../application/dto/comunicados.dto';
import {
  ActualizarComunicadoUseCase,
  CrearComunicadoUseCase,
  EliminarComunicadoUseCase,
  GetComunicadoUseCase,
  ListComunicadosAdminUseCase,
  PublicarComunicadoUseCase,
  ReenviarCorreoComunicadoUseCase,
} from '../../application/use-cases/comunicados.use-cases';
import { parseIds, SaveComunicadoRequestDto } from './dto/comunicados-request.dto';

const MAX_ARCHIVOS = 10;

function toArchivos(files: Express.Multer.File[] | undefined): ArchivoSubido[] {
  return (files ?? []).map((f) => ({
    buffer: f.buffer,
    originalName: f.originalname,
    mimeType: f.mimetype,
    size: f.size,
  }));
}

/** Administración de comunicados (sólo administradores). */
@ApiTags('Comunicados (admin)')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/comunicados')
export class AdminComunicadosController {
  constructor(
    private readonly listar: ListComunicadosAdminUseCase,
    private readonly detalle: GetComunicadoUseCase,
    private readonly crear: CrearComunicadoUseCase,
    private readonly actualizar: ActualizarComunicadoUseCase,
    private readonly publicar: PublicarComunicadoUseCase,
    private readonly reenviar: ReenviarCorreoComunicadoUseCase,
    private readonly eliminar: EliminarComunicadoUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los comunicados (borradores y publicados) con autor' })
  index(): Promise<ComunicadoDto[]> {
    return this.listar.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un comunicado para edición' })
  ver(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: Actor): Promise<ComunicadoDto> {
    return this.detalle.execute({ id, actor });
  }

  @Post()
  @ApiOperation({ summary: 'Crear comunicado con medios; si estado=publicado notifica y envía correo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('archivos', MAX_ARCHIVOS))
  guardar(
    @Body() dto: SaveComunicadoRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() actor: Actor,
  ): Promise<ComunicadoOperacionDto> {
    return this.crear.execute({
      actor,
      titulo: dto.titulo,
      resumen: dto.resumen ?? null,
      contenido: dto.contenido,
      estado: dto.estado === 'publicado' ? 'publicado' : 'borrador',
      archivos: toArchivos(files),
      videoUrls: dto.videoUrls ?? null,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar comunicado: textos, añadir medios y eliminar medios existentes' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('archivos', MAX_ARCHIVOS))
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveComunicadoRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<ComunicadoDto> {
    return this.actualizar.execute({
      id,
      titulo: dto.titulo,
      resumen: dto.resumen ?? null,
      contenido: dto.contenido,
      archivos: toArchivos(files),
      videoUrls: dto.videoUrls ?? null,
      eliminarMedios: parseIds(dto.eliminarMedios),
    });
  }

  @Post(':id/publicar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar: fija publicado_at, notifica a los colaboradores activos y envía el correo' })
  publicarComunicado(@Param('id', ParseIntPipe) id: number): Promise<ComunicadoOperacionDto> {
    return this.publicar.execute(id);
  }

  @Post(':id/reenviar-correo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reenviar el correo de un comunicado publicado' })
  reenviarCorreo(@Param('id', ParseIntPipe) id: number): Promise<ComunicadoOperacionDto> {
    return this.reenviar.execute(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar comunicado y sus archivos' })
  borrar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eliminar.execute(id);
  }
}
