import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ColaboradorDirectorioDto,
  ImportacionCargosResultadoDto,
  JerarquiaDto,
  OrganigramaDependenciasDto,
} from '../../application/dto/organigrama.dto';
import {
  BuscarDirectorioUseCase,
  GetJerarquiaUseCase,
  GetOrganigramaDependenciasUseCase,
  ImportarCargosUseCase,
} from '../../application/use-cases/organigrama.use-cases';
import { DirectorioQueryDto, ImportarCargosRequestDto } from './dto/organigrama-request.dto';

/**
 * Organigrama (dependencias y jerarquía de cargos), directorio de colaboradores e importador
 * de cargos/áreas. Lectura: cualquier usuario autenticado. Importador: admin.
 */
@ApiTags('Organigrama')
@ApiBearerAuth()
@Controller('organigrama')
export class OrganigramaController {
  constructor(
    private readonly getDependencias: GetOrganigramaDependenciasUseCase,
    private readonly getJerarquia: GetJerarquiaUseCase,
    private readonly buscarDirectorio: BuscarDirectorioUseCase,
    private readonly importarCargos: ImportarCargosUseCase,
  ) {}

  @Get('dependencias')
  @ApiOperation({ summary: 'Organigrama de dependencias: árbol de áreas activas con su responsable' })
  dependencias(): Promise<OrganigramaDependenciasDto> {
    return this.getDependencias.execute();
  }

  @Get('jerarquia')
  @ApiOperation({ summary: 'Árbol jerárquico de cargos con titulares activos' })
  jerarquia(): Promise<JerarquiaDto> {
    return this.getJerarquia.execute();
  }

  @Get('directorio')
  @ApiOperation({ summary: 'Directorio de colaboradores activos (filtros: q, areaId, sedeId)' })
  directorio(@Query() query: DirectorioQueryDto): Promise<ColaboradorDirectorioDto[]> {
    return this.buscarDirectorio.execute({ q: query.q, areaId: query.areaId, sedeId: query.sedeId });
  }

  @Post('importar-cargos')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Importar cargos y áreas desde un dataset pegado (crea faltantes y guarda salarios)' })
  importar(@Body() dto: ImportarCargosRequestDto): Promise<ImportacionCargosResultadoDto> {
    return this.importarCargos.execute({ dataset: dto.dataset });
  }
}
