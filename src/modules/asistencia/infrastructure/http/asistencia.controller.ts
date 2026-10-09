import {
  Body,
  Controller,
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
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  HistorialAsistenciaDto,
  ImportacionResultadoDto,
  MemorandosResultadoDto,
  PoliticaAsistenciaDto,
  ResumenAsistenciaDto,
  SedeAsistenciaDto,
} from '../../application/dto/asistencia.dto';
import { EnviarMemorandosUseCase } from '../../application/use-cases/enviar-memorandos.use-case';
import { GetMiHistorialUseCase } from '../../application/use-cases/get-mi-historial.use-case';
import { GetResumenDiarioUseCase } from '../../application/use-cases/get-resumen-diario.use-case';
import {
  ImportarMarcacionesUseCase,
  TAMANO_MAXIMO_BYTES,
} from '../../application/use-cases/importar-marcaciones.use-case';
import { ListSedesAsistenciaUseCase } from '../../application/use-cases/list-sedes.use-case';
import { GetPoliticaUseCase, SavePoliticaUseCase } from '../../application/use-cases/politica.use-cases';
import {
  EnviarMemorandosRequestDto,
  HistorialQueryDto,
  ImportarMarcacionesRequestDto,
  ResumenQueryDto,
  SavePoliticaRequestDto,
} from './dto/asistencia-request.dto';

/**
 * Asistencia: importación de marcaciones del reloj biométrico, resumen diario,
 * políticas por sede y memorandos de tardanza (administrador); historial
 * propio (cualquier usuario autenticado).
 */
@ApiTags('Asistencia')
@ApiBearerAuth()
@Controller('asistencia')
export class AsistenciaController {
  constructor(
    private readonly listSedes: ListSedesAsistenciaUseCase,
    private readonly getResumen: GetResumenDiarioUseCase,
    private readonly importar: ImportarMarcacionesUseCase,
    private readonly enviarMemorandos: EnviarMemorandosUseCase,
    private readonly getPolitica: GetPoliticaUseCase,
    private readonly savePolitica: SavePoliticaUseCase,
    private readonly miHistorial: GetMiHistorialUseCase,
  ) {}

  @Get('sedes')
  @Roles('admin')
  @ApiOperation({ summary: 'Sedes activas para el filtro de asistencia' })
  sedes(): Promise<SedeAsistenciaDto[]> {
    return this.listSedes.execute();
  }

  @Get('resumen')
  @Roles('admin')
  @ApiOperation({ summary: 'Resumen diario de una sede (reconsolida las marcaciones con la política vigente)' })
  resumen(@Query() query: ResumenQueryDto): Promise<ResumenAsistenciaDto> {
    return this.getResumen.execute({ sedeId: query.sedeId, fecha: query.fecha });
  }

  @Post('importar')
  @Roles('admin')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sedeId', 'archivo'],
      properties: {
        sedeId: { type: 'integer' },
        archivo: { type: 'string', format: 'binary', description: 'XLSX, CSV o TXT del reloj biométrico' },
      },
    },
  })
  @ApiOperation({ summary: 'Importar archivo de marcaciones de una sede' })
  importarArchivo(
    @Body() dto: ImportarMarcacionesRequestDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() actor: Actor,
  ): Promise<ImportacionResultadoDto> {
    return this.importar.execute({
      sedeId: dto.sedeId,
      actor,
      archivo: archivo
        ? { buffer: archivo.buffer, originalName: archivo.originalname, mimeType: archivo.mimetype }
        : null,
    });
  }

  @Post('memorandos')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar por correo los memorandos de tardanza pendientes de una sede y fecha' })
  memorandos(@Body() dto: EnviarMemorandosRequestDto): Promise<MemorandosResultadoDto> {
    return this.enviarMemorandos.execute({ sedeId: dto.sedeId, fecha: dto.fecha });
  }

  @Get('politicas/:sedeId')
  @Roles('admin')
  @ApiOperation({ summary: 'Política de asistencia de una sede (valores por defecto si no está configurada)' })
  politica(@Param('sedeId', ParseIntPipe) sedeId: number): Promise<PoliticaAsistenciaDto> {
    return this.getPolitica.execute({ sedeId });
  }

  @Put('politicas/:sedeId')
  @Roles('admin')
  @ApiOperation({ summary: 'Guardar la política de asistencia de una sede' })
  guardarPolitica(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: SavePoliticaRequestDto,
  ): Promise<PoliticaAsistenciaDto> {
    return this.savePolitica.execute({ sedeId, ...dto });
  }

  @Get('mi-historial')
  @ApiOperation({ summary: 'Historial de asistencia del usuario autenticado por rango de fechas' })
  historial(@Query() query: HistorialQueryDto, @CurrentUser() actor: Actor): Promise<HistorialAsistenciaDto[]> {
    return this.miHistorial.execute({ actor, desde: query.desde, hasta: query.hasta });
  }
}
