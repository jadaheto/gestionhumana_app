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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ColaboradorDto,
  ContratoDto,
  DocumentoGeneradoDto,
  ProrrogaDto,
  ProrrogaRegistradaDto,
} from '../../application/dto/contratos.dto';
import {
  EliminarContratoUseCase,
  GuardarContratoUseCase,
  ListarColaboradoresUseCase,
  ListarContratosUseCase,
  ListarProrrogasUseCase,
  ObtenerContratoUseCase,
  RegistrarProrrogaUseCase,
} from '../../application/use-cases/contratos.use-cases';
import {
  FIRMA_MAX_BYTES,
  GenerarDocumentoContratoUseCase,
} from '../../application/use-cases/generar-documento-contrato.use-case';
import {
  GenerarDocumentoRequestDto,
  GuardarContratoRequestDto,
  RegistrarProrrogaRequestDto,
} from './dto/contratos-request.dto';

/**
 * Contratos laborales. Lectura: admin ve todos, funcionario solo los suyos.
 * Escritura, prórrogas y cartas: solo administradores.
 */
@ApiTags('Contratos')
@ApiBearerAuth()
@Controller('contratos')
export class ContratosController {
  constructor(
    private readonly listar: ListarContratosUseCase,
    private readonly obtener: ObtenerContratoUseCase,
    private readonly guardar: GuardarContratoUseCase,
    private readonly eliminar: EliminarContratoUseCase,
    private readonly registrarProrroga: RegistrarProrrogaUseCase,
    private readonly listarProrrogas: ListarProrrogasUseCase,
    private readonly listarColaboradores: ListarColaboradoresUseCase,
    private readonly generarDocumento: GenerarDocumentoContratoUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar contratos (admin: todos; funcionario: los propios). Sincroniza vencidos y genera alertas.',
  })
  lista(@CurrentUser() actor: Actor): Promise<ContratoDto[]> {
    return this.listar.execute({ actor });
  }

  @Get('colaboradores')
  @Roles('admin')
  @ApiOperation({ summary: 'Colaboradores para el select del formulario (solo lectura)' })
  colaboradores(): Promise<ColaboradorDto[]> {
    return this.listarColaboradores.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un contrato' })
  detalle(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<ContratoDto> {
    return this.obtener.execute({ actor, id });
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear contrato' })
  crear(@Body() dto: GuardarContratoRequestDto): Promise<ContratoDto> {
    return this.guardar.execute(normalizar(dto));
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar contrato (el colaborador no cambia)' })
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarContratoRequestDto): Promise<ContratoDto> {
    return this.guardar.execute({ ...normalizar(dto), id });
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar contrato' })
  borrar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eliminar.execute(id);
  }

  @Post(':id/prorrogas')
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar prórroga (meses > 0). Devuelve la nueva fecha fin.' })
  prorrogar(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarProrrogaRequestDto,
  ): Promise<ProrrogaRegistradaDto> {
    return this.registrarProrroga.execute({
      actor,
      contratoId: id,
      meses: dto.meses,
      observacion: dto.observacion ?? '',
    });
  }

  @Get(':id/prorrogas')
  @ApiOperation({ summary: 'Historial de prórrogas del contrato' })
  prorrogas(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<ProrrogaDto[]> {
    return this.listarProrrogas.execute({ actor, contratoId: id });
  }

  // ---------- Cartas (PDF) ----------

  @Post(':id/documentos')
  @Roles('admin')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('firmaPng', { limits: { fileSize: FIRMA_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Generar carta (asistente pasos 1 y 2) con firma PNG opcional. Devuelve PDF.' })
  async generar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerarDocumentoRequestDto,
    @UploadedFile() firma: Express.Multer.File | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.generarDocumento.execute({
      contratoId: id,
      tipo: dto.tipo,
      meses: dto.meses,
      numero: dto.numero,
      anios: dto.anios,
      codigo: dto.codigo,
      firmanteNombre: dto.firmanteNombre,
      firmanteCargo: dto.firmanteCargo,
      revisoUno: dto.revisoUno,
      revisoDos: dto.revisoDos,
      proyecto: dto.proyecto,
      firmaPng: firma?.buffer ?? null,
      firmaPngNombre: firma?.originalname ?? null,
    });
    enviarPdf(res, doc);
  }

  @Get(':id/documentos/preaviso')
  @Roles('admin')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Preaviso de terminación con valores por defecto (PDF)' })
  async preaviso(@Param('id', ParseIntPipe) id: number, @Res() res: Response): Promise<void> {
    enviarPdf(res, await this.generarDocumento.execute({ contratoId: id, tipo: 'preaviso' }));
  }

  @Get(':id/documentos/prorroga')
  @Roles('admin')
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'meses', required: false, type: Number })
  @ApiQuery({ name: 'numero', required: false, type: Number })
  @ApiOperation({ summary: 'Carta de prórroga con valores por defecto (PDF)' })
  async prorroga(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Query('meses') meses?: string,
    @Query('numero') numero?: string,
  ): Promise<void> {
    enviarPdf(
      res,
      await this.generarDocumento.execute({
        contratoId: id,
        tipo: 'prorroga',
        meses: entero(meses),
        numero: entero(numero),
      }),
    );
  }

  @Get(':id/documentos/renovacion')
  @Roles('admin')
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'anios', required: false, type: Number })
  @ApiOperation({ summary: 'Carta de renovación con valores por defecto (PDF)' })
  async renovacion(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Query('anios') anios?: string,
  ): Promise<void> {
    enviarPdf(res, await this.generarDocumento.execute({ contratoId: id, tipo: 'renovacion', anios: entero(anios) }));
  }
}

function normalizar(dto: GuardarContratoRequestDto) {
  return {
    userId: dto.userId,
    tipoContrato: dto.tipoContrato,
    numeroContrato: dto.numeroContrato,
    fechaInicio: dto.fechaInicio,
    fechaFin: dto.fechaFin ? dto.fechaFin : null,
    salarioBase: dto.salarioBase,
    estado: dto.estado ?? 'activo',
    observaciones: dto.observaciones ?? null,
  };
}

/** Query numérica opcional: igual que `max((int) $this->input->get('x'), 1)` en el caso de uso. */
function entero(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function enviarPdf(res: Response, doc: DocumentoGeneradoDto): void {
  res.set({
    'Content-Type': doc.mimeType,
    'Content-Disposition': `attachment; filename="${doc.filename}"`,
    'Content-Length': String(doc.contenido.length),
  });
  res.send(doc.contenido);
}
