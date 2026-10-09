import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { ArchivoSubido, PermisoDto, SuspenderVacacionesResultado } from '../../application/dto/beneficios.dto';
import {
  AprobarSolicitudUseCase,
  CrearSolicitudUseCase,
  ListarMisSolicitudesUseCase,
  ListarSolicitudesAdminUseCase,
  RechazarSolicitudUseCase,
  SOPORTES_MAX_BYTES,
  SuspenderVacacionesUseCase,
} from '../../application/use-cases/solicitudes.use-cases';
import {
  CrearSolicitudRequestDto,
  FiltroSolicitudesQueryDto,
  ResolverSolicitudRequestDto,
  SuspenderVacacionesRequestDto,
} from './dto/beneficios-request.dto';

/** Archivo tal como lo entrega multer (memoria). */
export interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export function toArchivoSubido(file?: MulterFile): ArchivoSubido | null {
  if (!file || !file.buffer) return null;
  return { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype };
}

/**
 * Solicitudes de permisos, vacaciones e incapacidades (legado `Solicitudes.php`).
 * Un funcionario crea y consulta sólo sus solicitudes; el administrador las
 * lista todas y las aprueba, rechaza o suspende (vacaciones).
 */
@ApiTags('Solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
export class SolicitudesController {
  constructor(
    private readonly crear: CrearSolicitudUseCase,
    private readonly listarMias: ListarMisSolicitudesUseCase,
    private readonly listarAdmin: ListarSolicitudesAdminUseCase,
    private readonly aprobar: AprobarSolicitudUseCase,
    private readonly rechazar: RechazarSolicitudUseCase,
    private readonly suspender: SuspenderVacacionesUseCase,
  ) {}

  @Get('mis-permisos')
  @ApiOperation({ summary: 'Mis solicitudes (más recientes primero)' })
  misPermisos(@CurrentUser() actor: Actor): Promise<PermisoDto[]> {
    return this.listarMias.execute(actor);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una solicitud (multipart; soporte opcional, obligatorio para incapacidad)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tipoPermiso', 'fechaInicio', 'fechaFin', 'justificacion'],
      properties: {
        tipoPermiso: { type: 'string' },
        fechaInicio: { type: 'string', example: '2026-03-02T08:00' },
        fechaFin: { type: 'string', example: '2026-03-02T12:00' },
        horas: { type: 'number' },
        justificacion: { type: 'string' },
        archivoSoporte: {
          type: 'string',
          format: 'binary',
          description: 'gif, jpg, jpeg, png, pdf, doc, docx (máx. 5 MB)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('archivoSoporte', { limits: { fileSize: SOPORTES_MAX_BYTES } }))
  crearSolicitud(
    @CurrentUser() actor: Actor,
    @Body() dto: CrearSolicitudRequestDto,
    @UploadedFile() file?: MulterFile,
  ): Promise<PermisoDto> {
    return this.crear.execute({
      actor,
      tipoPermiso: dto.tipoPermiso,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      horas: dto.horas ?? null,
      justificacion: dto.justificacion,
      archivo: toArchivoSubido(file),
    });
  }

  @Get('admin')
  @Roles('admin')
  @ApiOperation({ summary: 'Todas las solicitudes con colaborador y aprobador (admin), filtrables por estado' })
  admin(@Query() query: FiltroSolicitudesQueryDto): Promise<PermisoDto[]> {
    return this.listarAdmin.execute({ estado: query.estado ?? null });
  }

  @Post(':id/aprobar')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aprobar una solicitud pendiente (vacaciones: valida días hábiles y saldo)' })
  aprobarSolicitud(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverSolicitudRequestDto,
  ): Promise<PermisoDto> {
    return this.aprobar.execute({ actor, permisoId: id, observacion: dto.observacion ?? null });
  }

  @Post(':id/rechazar')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rechazar una solicitud pendiente' })
  rechazarSolicitud(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverSolicitudRequestDto,
  ): Promise<PermisoDto> {
    return this.rechazar.execute({ actor, permisoId: id, observacion: dto.observacion ?? null });
  }

  @Post(':id/suspender-vacaciones')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspender vacaciones aprobadas reintegrando los días no disfrutados' })
  suspenderVacaciones(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SuspenderVacacionesRequestDto,
  ): Promise<SuspenderVacacionesResultado> {
    return this.suspender.execute({
      actor,
      permisoId: id,
      diasDisfrutados: dto.diasDisfrutados,
      motivo: dto.motivo ?? null,
    });
  }
}
