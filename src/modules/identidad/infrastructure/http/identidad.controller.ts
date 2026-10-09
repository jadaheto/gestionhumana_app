import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { IdentidadDto } from '../../application/dto/identidad.dto';
import { GetIdentidadUseCase, SaveIdentidadUseCase } from '../../application/use-cases/identidad.use-cases';
import { SaveIdentidadRequestDto } from './dto/identidad-request.dto';

/** Identidad empresarial: misión, visión, historia, trayectoria e himno. */
@ApiTags('Identidad')
@ApiBearerAuth()
@Controller('identidad')
export class IdentidadController {
  constructor(
    private readonly obtener: GetIdentidadUseCase,
    private readonly guardar: SaveIdentidadUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Contenido de la identidad empresarial' })
  get(): Promise<IdentidadDto> {
    return this.obtener.execute();
  }

  @Put()
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar la identidad empresarial (sólo los campos enviados)' })
  save(@Body() dto: SaveIdentidadRequestDto): Promise<IdentidadDto> {
    return this.guardar.execute(dto);
  }
}
