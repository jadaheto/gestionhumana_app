import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ColaboradorBusquedaDto,
  SalarioReferenciaDto,
  SiguienteNumeroDto,
  SolicitudDetalleDto,
  SolicitudResumenDto,
} from '../../application/dto/endeudamiento.dto';
import {
  BuscarColaboradorUseCase,
  CrearSolicitudUseCase,
  GenerarNumeroSolicitudUseCase,
  GetSalarioReferenciaUseCase,
  GetSolicitudUseCase,
  ListSolicitudesUseCase,
} from '../../application/use-cases/endeudamiento.use-cases';
import { BuscarColaboradorQueryDto, CrearSolicitudRequestDto } from './dto/endeudamiento-request.dto';

/** Evaluaciones de nivel de endeudamiento. Todo el recurso es de administración. */
@ApiTags('Endeudamiento')
@ApiBearerAuth()
@Roles('admin')
@Controller('endeudamiento')
export class EndeudamientoController {
  constructor(
    private readonly listar: ListSolicitudesUseCase,
    private readonly ver: GetSolicitudUseCase,
    private readonly crear: CrearSolicitudUseCase,
    private readonly numerador: GenerarNumeroSolicitudUseCase,
    private readonly buscar: BuscarColaboradorUseCase,
    private readonly salario: GetSalarioReferenciaUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar evaluaciones de endeudamiento' })
  lista(): Promise<SolicitudResumenDto[]> {
    return this.listar.execute();
  }

  @Get('siguiente-numero')
  @ApiOperation({ summary: 'Siguiente número de solicitud (SOL-<año>-####)' })
  siguienteNumero(): Promise<SiguienteNumeroDto> {
    return this.numerador.execute();
  }

  @Get('colaboradores')
  @ApiOperation({ summary: 'Buscar colaboradores por nombre, cédula o código con su salario de referencia' })
  colaboradores(@Query() query: BuscarColaboradorQueryDto): Promise<ColaboradorBusquedaDto[]> {
    return this.buscar.execute({ q: query.q });
  }

  @Get('colaboradores/:userId/salario-referencia')
  @ApiOperation({ summary: 'Salario de referencia de un colaborador (contrato activo o tabla de cargos)' })
  salarioReferencia(@Param('userId', ParseIntPipe) userId: number): Promise<SalarioReferenciaDto> {
    return this.salario.execute(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una evaluación con sus conceptos' })
  detalle(@Param('id', ParseIntPipe) id: number): Promise<SolicitudDetalleDto> {
    return this.ver.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una evaluación (calcula porcentajes, estado y conclusión)' })
  crearSolicitud(@Body() dto: CrearSolicitudRequestDto, @CurrentUser() actor: Actor): Promise<SolicitudDetalleDto> {
    return this.crear.execute({
      ...dto,
      actor,
      conceptos: dto.conceptos.map((c) => ({
        concepto: c.concepto,
        devengado: c.devengado ?? 0,
        deducido: c.deducido ?? 0,
      })),
    });
  }
}
