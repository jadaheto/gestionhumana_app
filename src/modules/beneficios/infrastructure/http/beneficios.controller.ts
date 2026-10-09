import { Body, Controller, Get, Param, ParseIntPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ColaboradorDto,
  IncapacidadDto,
  PermisoDto,
  ResumenVacacionesDto,
  VacacionDto,
} from '../../application/dto/beneficios.dto';
import {
  INCAPACIDADES_MAX_BYTES,
  ListarColaboradoresUseCase,
  ListarIncapacidadesUseCase,
  RegistrarIncapacidadUseCase,
} from '../../application/use-cases/incapacidades.use-cases';
import { ListarMisSolicitudesUseCase } from '../../application/use-cases/solicitudes.use-cases';
import { GetResumenVacacionesUseCase, ListarVacacionesUseCase } from '../../application/use-cases/vacaciones.use-cases';
import { RegistrarIncapacidadRequestDto } from './dto/beneficios-request.dto';
import { toArchivoSubido } from './solicitudes.controller';
import type { MulterFile } from './solicitudes.controller';

/**
 * Beneficios: vacaciones, permisos e incapacidades (legado `Beneficios.php`)
 * y saldo de vacaciones de Mi puesto (`MiPuesto::vacaciones_pendientes`).
 */
@ApiTags('Beneficios')
@ApiBearerAuth()
@Controller('beneficios')
export class BeneficiosController {
  constructor(
    private readonly listarVacaciones: ListarVacacionesUseCase,
    private readonly resumenVacaciones: GetResumenVacacionesUseCase,
    private readonly listarPermisos: ListarMisSolicitudesUseCase,
    private readonly listarIncapacidades: ListarIncapacidadesUseCase,
    private readonly registrarIncapacidad: RegistrarIncapacidadUseCase,
    private readonly listarColaboradores: ListarColaboradoresUseCase,
  ) {}

  // ---------- Vacaciones ----------

  @Get('vacaciones')
  @ApiOperation({ summary: 'Períodos de vacaciones: propios (funcionario) o de todos con colaborador (admin)' })
  vacaciones(@CurrentUser() actor: Actor): Promise<VacacionDto[]> {
    return this.listarVacaciones.execute(actor);
  }

  @Get('vacaciones/saldo')
  @ApiOperation({
    summary: 'Saldo de vacaciones del usuario autenticado (períodos, acumulados, consumidos, pendientes)',
  })
  miSaldo(@CurrentUser() actor: Actor): Promise<ResumenVacacionesDto> {
    return this.resumenVacaciones.execute({ actor });
  }

  @Get('vacaciones/saldo/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Saldo de vacaciones de un colaborador (admin)' })
  saldoDe(@CurrentUser() actor: Actor, @Param('userId', ParseIntPipe) userId: number): Promise<ResumenVacacionesDto> {
    return this.resumenVacaciones.execute({ actor, userId });
  }

  // ---------- Permisos ----------

  @Get('permisos')
  @ApiOperation({ summary: 'Permisos del usuario autenticado' })
  permisos(@CurrentUser() actor: Actor): Promise<PermisoDto[]> {
    return this.listarPermisos.execute(actor);
  }

  // ---------- Incapacidades ----------

  @Get('incapacidades')
  @ApiOperation({ summary: 'Incapacidades: propias (funcionario) o de todos con colaborador (admin)' })
  incapacidades(@CurrentUser() actor: Actor): Promise<IncapacidadDto[]> {
    return this.listarIncapacidades.execute(actor);
  }

  @Post('incapacidades')
  @ApiOperation({ summary: 'Registrar incapacidad (multipart; el admin puede indicar userId)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tipo', 'fechaInicio', 'fechaFin'],
      properties: {
        userId: { type: 'integer', description: 'Sólo administradores' },
        tipo: { type: 'string' },
        fechaInicio: { type: 'string', example: '2026-03-02' },
        fechaFin: { type: 'string', example: '2026-03-04' },
        dias: { type: 'integer' },
        entidadEmisora: { type: 'string' },
        numeroIncapacidad: { type: 'string' },
        archivoSoporte: { type: 'string', format: 'binary', description: 'gif, jpg, jpeg, png, pdf (máx. 5 MB)' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('archivoSoporte', { limits: { fileSize: INCAPACIDADES_MAX_BYTES } }))
  registrar(
    @CurrentUser() actor: Actor,
    @Body() dto: RegistrarIncapacidadRequestDto,
    @UploadedFile() file?: MulterFile,
  ): Promise<IncapacidadDto> {
    return this.registrarIncapacidad.execute({
      actor,
      userId: dto.userId ?? null,
      tipo: dto.tipo,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      dias: dto.dias ?? null,
      entidadEmisora: dto.entidadEmisora ?? null,
      numeroIncapacidad: dto.numeroIncapacidad ?? null,
      archivo: toArchivoSubido(file),
    });
  }

  // ---------- Colaboradores (select) ----------

  @Get('colaboradores')
  @Roles('admin')
  @ApiOperation({ summary: 'Colaboradores activos para selects (id, nombre, cédula)' })
  colaboradores(): Promise<ColaboradorDto[]> {
    return this.listarColaboradores.execute();
  }
}
