import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { ApiKeyDto } from '../../application/dto/colaboracion.dto';
import {
  AlternarEstadoApiKeyUseCase,
  CrearApiKeyUseCase,
  EliminarApiKeysUseCase,
  ListApiKeysUseCase,
  RegenerarApiKeyUseCase,
  RenombrarApiKeyUseCase,
} from '../../application/use-cases/api-keys.use-cases';
import { ApiKeyNombreRequestDto, EliminarApiKeysRequestDto } from './dto/colaboracion-request.dto';

/** Claves API propias del usuario (sustituye a `Apikey.php`). */
@ApiTags('Colaboración · API keys')
@ApiBearerAuth()
@Controller('colaboracion/api-keys')
export class ApiKeysController {
  constructor(
    private readonly listKeys: ListApiKeysUseCase,
    private readonly crearKey: CrearApiKeyUseCase,
    private readonly renombrar: RenombrarApiKeyUseCase,
    private readonly regenerar: RegenerarApiKeyUseCase,
    private readonly alternar: AlternarEstadoApiKeyUseCase,
    private readonly eliminar: EliminarApiKeysUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mis claves API' })
  listar(@CurrentUser() actor: Actor): Promise<ApiKeyDto[]> {
    return this.listKeys.execute(actor);
  }

  @Post()
  @ApiOperation({ summary: 'Crear clave API' })
  crear(@CurrentUser() actor: Actor, @Body() dto: ApiKeyNombreRequestDto): Promise<ApiKeyDto> {
    return this.crearKey.execute({ actor, nombre: dto.nombre });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Renombrar clave API' })
  editar(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApiKeyNombreRequestDto,
  ): Promise<ApiKeyDto> {
    return this.renombrar.execute({ actor, id, nombre: dto.nombre });
  }

  @Post(':id/regenerar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Regenerar la clave' })
  regenerarClave(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<ApiKeyDto> {
    return this.regenerar.execute({ actor, id });
  }

  @Post(':id/alternar-estado')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activar / desactivar la clave' })
  alternarEstado(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<ApiKeyDto> {
    return this.alternar.execute({ actor, id });
  }

  @Post('eliminar-multiples')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar varias claves propias' })
  eliminarVarias(@CurrentUser() actor: Actor, @Body() dto: EliminarApiKeysRequestDto): Promise<{ eliminadas: number }> {
    return this.eliminar.execute({ actor, ids: dto.ids });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar clave API' })
  async eliminarUna(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.eliminar.execute({ actor, ids: [id] });
  }
}
