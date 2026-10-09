import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { ConfirmarImportacionDto, LoteDto, NominaPreviewDto, ProgresoLoteDto } from '../../application/dto/nomina.dto';
import {
  CancelarImportacionUseCase,
  CerrarLotesAtascadosUseCase,
  ConfirmarImportacionUseCase,
  GetLoteUseCase,
  HistorialImportacionesUseCase,
  MAX_PDF_BYTES,
  ObtenerPreviewUseCase,
  PrevisualizarImportacionUseCase,
  ProcesarLoteUseCase,
} from '../../application/use-cases/importacion-nomina.use-cases';
import { PreviewImportacionRequestDto, ProcesarLoteRequestDto } from './dto/nomina-request.dto';

/** Archivo subido por multer (en memoria). */
interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Importación de nómina desde el PDF de liquidación (sólo administradores).
 * Flujo: preview (fase 1) → confirmar (crea lote) → procesar por tandas → historial.
 */
@ApiTags('Admin · Importación de nómina')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/nomina/importaciones')
export class NominaImportacionController {
  constructor(
    private readonly previsualizar: PrevisualizarImportacionUseCase,
    private readonly obtenerPreview: ObtenerPreviewUseCase,
    private readonly confirmar: ConfirmarImportacionUseCase,
    private readonly cancelar: CancelarImportacionUseCase,
    private readonly procesar: ProcesarLoteUseCase,
    private readonly getLote: GetLoteUseCase,
    private readonly historial: HistorialImportacionesUseCase,
    private readonly cerrarAtascados: CerrarLotesAtascadosUseCase,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_PDF_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary', description: 'PDF de liquidación de nómina (máx. 50 MB)' },
        fuente: { type: 'string', enum: ['auto', 'COLEGIO', 'CAMPANOS', 'COMFASUCRE'] },
      },
    },
  })
  @ApiOperation({ summary: 'Fase 1: subir el PDF, parsearlo y obtener la vista previa (token)' })
  preview(
    @CurrentUser() actor: Actor,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() dto: PreviewImportacionRequestDto,
  ): Promise<NominaPreviewDto> {
    if (!archivo || !archivo.buffer || archivo.size === 0) {
      throw new ValidationError('Debes seleccionar el archivo PDF de nómina.');
    }
    return this.previsualizar.execute({
      actor,
      archivo: archivo.buffer,
      nombreOriginal: archivo.originalname,
      mimeType: archivo.mimetype,
      fuente: dto.fuente ?? null,
    });
  }

  @Get('preview/:token')
  @ApiOperation({ summary: 'Consultar una vista previa pendiente por token' })
  verPreview(@Param('token') token: string): Promise<NominaPreviewDto> {
    return this.obtenerPreview.execute(token);
  }

  @Post(':token/confirmar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fase 2a: confirmar la vista previa y crear el lote de importación' })
  confirmarImportacion(@CurrentUser() actor: Actor, @Param('token') token: string): Promise<ConfirmarImportacionDto> {
    return this.confirmar.execute({ actor, token });
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancelar una vista previa no confirmada (elimina el PDF temporal)' })
  cancelarImportacion(@Param('token') token: string): Promise<void> {
    return this.cancelar.execute(token);
  }

  @Post('lotes/:id/procesar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fase 2b: procesar una tanda de empleados del lote y devolver el avance' })
  procesarLote(@Param('id', ParseIntPipe) id: number, @Body() dto: ProcesarLoteRequestDto): Promise<ProgresoLoteDto> {
    return this.procesar.execute({ loteId: id, offset: dto.offset ?? null, size: dto.size ?? null });
  }

  @Get('lotes/:id')
  @ApiOperation({ summary: 'Estado y contadores de un lote' })
  lote(@Param('id', ParseIntPipe) id: number): Promise<LoteDto> {
    return this.getLote.execute(id);
  }

  @Get()
  @ApiOperation({ summary: 'Historial de importaciones (últimos 100 lotes con sus errores)' })
  listar(): Promise<LoteDto[]> {
    return this.historial.execute();
  }

  @Post('cerrar-atascados')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar como error los lotes en "procesando" desde hace más de 30 minutos' })
  cerrar(): Promise<{ cerrados: number }> {
    return this.cerrarAtascados.execute();
  }
}
