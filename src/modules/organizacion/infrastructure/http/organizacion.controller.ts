import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { AreaDto, CargoDto, SedeDto } from '../../application/dto/organizacion.dto';
import { DeleteAreaUseCase, ListAreasUseCase, SaveAreaUseCase } from '../../application/use-cases/areas.use-cases';
import { DeleteCargoUseCase, ListCargosUseCase, SaveCargoUseCase } from '../../application/use-cases/cargos.use-cases';
import { DeleteSedeUseCase, ListSedesUseCase, SaveSedeUseCase } from '../../application/use-cases/sedes.use-cases';
import { SaveAreaRequestDto, SaveCargoRequestDto, SaveSedeRequestDto } from './dto/organizacion-request.dto';

/**
 * Catálogos organizacionales: sedes, áreas y cargos.
 * Lectura: cualquier usuario autenticado (se usan en selects).
 * Escritura: sólo administradores.
 */
@ApiTags('Organización')
@ApiBearerAuth()
@Controller('organizacion')
export class OrganizacionController {
  constructor(
    private readonly listSedes: ListSedesUseCase,
    private readonly saveSede: SaveSedeUseCase,
    private readonly deleteSede: DeleteSedeUseCase,
    private readonly listAreas: ListAreasUseCase,
    private readonly saveArea: SaveAreaUseCase,
    private readonly deleteArea: DeleteAreaUseCase,
    private readonly listCargos: ListCargosUseCase,
    private readonly saveCargo: SaveCargoUseCase,
    private readonly deleteCargo: DeleteCargoUseCase,
  ) {}

  // ---------- Sedes ----------
  @Get('sedes')
  @ApiOperation({ summary: 'Listar sedes' })
  @ApiQuery({ name: 'activas', required: false, type: Boolean })
  sedes(@Query('activas') activas?: string): Promise<SedeDto[]> {
    return this.listSedes.execute({ soloActivas: activas === 'true' });
  }

  @Post('sedes')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear sede' })
  crearSede(@Body() dto: SaveSedeRequestDto): Promise<SedeDto> {
    return this.saveSede.execute(normalizeSede(dto));
  }

  @Put('sedes/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar sede' })
  editarSede(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveSedeRequestDto): Promise<SedeDto> {
    return this.saveSede.execute({ ...normalizeSede(dto), id });
  }

  @Delete('sedes/:id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar sede' })
  eliminarSede(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteSede.execute(id);
  }

  // ---------- Áreas ----------
  @Get('areas')
  @ApiOperation({ summary: 'Listar áreas (con nombre de sede)' })
  @ApiQuery({ name: 'activas', required: false, type: Boolean })
  areas(@Query('activas') activas?: string): Promise<AreaDto[]> {
    return this.listAreas.execute({ soloActivas: activas === 'true' });
  }

  @Post('areas')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear área' })
  crearArea(@Body() dto: SaveAreaRequestDto): Promise<AreaDto> {
    return this.saveArea.execute({
      ...dto,
      sedeId: dto.sedeId ?? null,
      responsableId: dto.responsableId ?? null,
      descripcion: dto.descripcion ?? null,
    });
  }

  @Put('areas/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar área' })
  editarArea(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveAreaRequestDto): Promise<AreaDto> {
    return this.saveArea.execute({
      ...dto,
      id,
      sedeId: dto.sedeId ?? null,
      responsableId: dto.responsableId ?? null,
      descripcion: dto.descripcion ?? null,
    });
  }

  @Delete('areas/:id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar área' })
  eliminarArea(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteArea.execute(id);
  }

  // ---------- Cargos ----------
  @Get('cargos')
  @ApiOperation({ summary: 'Listar cargos (con nombre de área)' })
  @ApiQuery({ name: 'activos', required: false, type: Boolean })
  cargos(@Query('activos') activos?: string): Promise<CargoDto[]> {
    return this.listCargos.execute({ soloActivos: activos === 'true' });
  }

  @Post('cargos')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear cargo' })
  crearCargo(@Body() dto: SaveCargoRequestDto): Promise<CargoDto> {
    return this.saveCargo.execute(normalizeCargo(dto));
  }

  @Put('cargos/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar cargo' })
  editarCargo(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveCargoRequestDto): Promise<CargoDto> {
    return this.saveCargo.execute({ ...normalizeCargo(dto), id });
  }

  @Delete('cargos/:id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar cargo' })
  eliminarCargo(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deleteCargo.execute(id);
  }
}

function normalizeCargo(dto: SaveCargoRequestDto) {
  return {
    nombre: dto.nombre,
    descripcion: dto.descripcion ?? null,
    areaId: dto.areaId ?? null,
    nivelJerarquico: dto.nivelJerarquico ?? 5,
    funciones: dto.funciones ?? null,
    estado: dto.estado,
  };
}

function normalizeSede(dto: SaveSedeRequestDto) {
  return {
    nombre: dto.nombre,
    direccion: dto.direccion ?? null,
    ciudad: dto.ciudad ?? null,
    telefono: dto.telefono ?? null,
    estado: dto.estado,
  };
}
