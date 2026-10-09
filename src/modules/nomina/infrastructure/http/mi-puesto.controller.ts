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
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import {
  ArchivoPdfDto,
  CertificadoDto,
  ContratosCertificablesDto,
  CuentaBancariaDto,
  DesprendibleDetalleDto,
  DesprendibleResumenDto,
  ReportesResumenDto,
} from '../../application/dto/nomina.dto';
import {
  GenerarCertificadoIngresosUseCase,
  GenerarCertificadoLaboralUseCase,
  GetContratosCertificablesUseCase,
  ListCertificadosUseCase,
} from '../../application/use-cases/certificados.use-cases';
import {
  DeleteCuentaBancariaUseCase,
  ListCuentasBancariasUseCase,
  SaveCuentaBancariaUseCase,
} from '../../application/use-cases/cuentas-bancarias.use-cases';
import {
  DescargarDesprendiblePdfUseCase,
  GetDesprendibleUseCase,
  GetReportesResumenUseCase,
  ListDesprendiblesUseCase,
} from '../../application/use-cases/desprendibles.use-cases';
import {
  GenerarCertificadoIngresosRequestDto,
  GenerarCertificadoLaboralRequestDto,
  SaveCuentaBancariaRequestDto,
} from './dto/nomina-request.dto';

/** Envía un PDF generado como descarga (`Content-Disposition: attachment`). */
export function enviarPdf(res: Response, archivo: ArchivoPdfDto): StreamableFile {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${archivo.filename}"`,
    'Content-Length': String(archivo.content.length),
  });
  return new StreamableFile(archivo.content);
}

/**
 * "Mi puesto de trabajo": cuentas bancarias, desprendibles, reportes y
 * certificados del propio funcionario (siempre sobre `actor.id`).
 */
@ApiTags('Mi puesto de trabajo')
@ApiBearerAuth()
@Controller('mi-puesto')
export class MiPuestoController {
  constructor(
    private readonly listCuentas: ListCuentasBancariasUseCase,
    private readonly saveCuenta: SaveCuentaBancariaUseCase,
    private readonly deleteCuenta: DeleteCuentaBancariaUseCase,
    private readonly listDesprendibles: ListDesprendiblesUseCase,
    private readonly getDesprendible: GetDesprendibleUseCase,
    private readonly descargarDesprendible: DescargarDesprendiblePdfUseCase,
    private readonly reportes: GetReportesResumenUseCase,
    private readonly listCertificados: ListCertificadosUseCase,
    private readonly contratosCertificables: GetContratosCertificablesUseCase,
    private readonly certificadoLaboral: GenerarCertificadoLaboralUseCase,
    private readonly certificadoIngresos: GenerarCertificadoIngresosUseCase,
  ) {}

  // ---------- Cuentas bancarias ----------
  @Get('cuentas')
  @ApiOperation({ summary: 'Listar mis cuentas bancarias' })
  cuentas(@CurrentUser() actor: Actor): Promise<CuentaBancariaDto[]> {
    return this.listCuentas.execute(actor);
  }

  @Post('cuentas')
  @ApiOperation({ summary: 'Registrar una cuenta bancaria' })
  crearCuenta(@CurrentUser() actor: Actor, @Body() dto: SaveCuentaBancariaRequestDto): Promise<CuentaBancariaDto> {
    return this.saveCuenta.execute({ actor, input: dto });
  }

  @Put('cuentas/:id')
  @ApiOperation({ summary: 'Editar una cuenta bancaria propia' })
  editarCuenta(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveCuentaBancariaRequestDto,
  ): Promise<CuentaBancariaDto> {
    return this.saveCuenta.execute({ actor, input: { ...dto, id } });
  }

  @Delete('cuentas/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una cuenta bancaria propia' })
  eliminarCuenta(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteCuenta.execute({ actor, id });
  }

  // ---------- Desprendibles ----------
  @Get('desprendibles')
  @ApiOperation({ summary: 'Listar mis desprendibles de nómina' })
  desprendibles(@CurrentUser() actor: Actor): Promise<DesprendibleResumenDto[]> {
    return this.listDesprendibles.execute(actor);
  }

  @Get('desprendibles/:id')
  @ApiOperation({ summary: 'Detalle de un desprendible propio (conceptos devengados y deducidos)' })
  desprendible(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<DesprendibleDetalleDto> {
    return this.getDesprendible.execute({ actor, id });
  }

  @Get('desprendibles/:id/pdf')
  @ApiOperation({ summary: 'Descargar el comprobante de pago en PDF' })
  @ApiProduces('application/pdf')
  async desprendiblePdf(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarPdf(res, await this.descargarDesprendible.execute({ actor, id }));
  }

  // ---------- Reportes ----------
  @Get('reportes')
  @ApiOperation({ summary: 'Resumen de mis reportes (desprendibles, certificados, cuentas)' })
  reportesResumen(@CurrentUser() actor: Actor): Promise<ReportesResumenDto> {
    return this.reportes.execute(actor);
  }

  // ---------- Certificados ----------
  @Get('certificados')
  @ApiOperation({ summary: 'Historial de mis certificados generados' })
  @ApiQuery({ name: 'tipo', required: false, enum: ['laboral', 'ingresos_retenciones'] })
  certificados(@CurrentUser() actor: Actor, @Query('tipo') tipo?: string): Promise<CertificadoDto[]> {
    const filtro = tipo === 'laboral' || tipo === 'ingresos_retenciones' ? tipo : undefined;
    return this.listCertificados.execute({ actor, tipo: filtro });
  }

  @Get('certificados/laboral/contratos')
  @ApiOperation({ summary: 'Contrato actual y contratos vencidos certificables' })
  contratos(@CurrentUser() actor: Actor): Promise<ContratosCertificablesDto> {
    return this.contratosCertificables.execute(actor);
  }

  @Post('certificados/laboral')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar certificado laboral (con o sin funciones) en PDF' })
  @ApiProduces('application/pdf')
  async generarLaboral(
    @CurrentUser() actor: Actor,
    @Body() dto: GenerarCertificadoLaboralRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.certificadoLaboral.execute({
      actor,
      input: { modo: dto.modo, contratoId: dto.contratoId ?? null, incluirFunciones: dto.incluirFunciones === true },
    });
    return enviarPdf(res, archivo);
  }

  @Post('certificados/ingresos')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar certificado de ingresos y retenciones de un año en PDF' })
  @ApiProduces('application/pdf')
  async generarIngresos(
    @CurrentUser() actor: Actor,
    @Body() dto: GenerarCertificadoIngresosRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return enviarPdf(res, await this.certificadoIngresos.execute({ actor, input: { anio: dto.anio } }));
  }
}
