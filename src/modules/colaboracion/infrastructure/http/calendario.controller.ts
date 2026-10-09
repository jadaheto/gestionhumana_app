import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { EventoCalendarioDto } from '../../application/dto/colaboracion.dto';
import {
  EliminarEventoUseCase,
  GuardarEventoUseCase,
  ListEventosUseCase,
} from '../../application/use-cases/calendario.use-cases';
import { GuardarEventoRequestDto } from './dto/colaboracion-request.dto';

/** Calendario personal (sustituye a `Calendar.php`). Cada usuario sólo ve y edita sus propios eventos. */
@ApiTags('Colaboración · Calendario')
@ApiBearerAuth()
@Controller('colaboracion/calendario/eventos')
export class CalendarioController {
  constructor(
    private readonly listEventos: ListEventosUseCase,
    private readonly guardarEvento: GuardarEventoUseCase,
    private readonly eliminarEvento: EliminarEventoUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Eventos propios en un rango de fechas (+ cumpleaños y aniversarios del sistema)' })
  @ApiQuery({ name: 'desde', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-10-31' })
  @ApiQuery({ name: 'sistema', required: false, type: Boolean, description: 'false para excluir eventos de sistema' })
  listar(
    @CurrentUser() actor: Actor,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('sistema') sistema?: string,
  ): Promise<EventoCalendarioDto[]> {
    return this.listEventos.execute({
      actor,
      desde: desde || undefined,
      hasta: hasta || undefined,
      incluirSistema: sistema !== 'false',
    });
  }

  @Post()
  @ApiOperation({ summary: 'Crear evento' })
  crear(@CurrentUser() actor: Actor, @Body() dto: GuardarEventoRequestDto): Promise<EventoCalendarioDto> {
    return this.guardarEvento.execute({ actor, input: dto });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar evento propio' })
  editar(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarEventoRequestDto,
  ): Promise<EventoCalendarioDto> {
    return this.guardarEvento.execute({ actor, input: { ...dto, id } });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar evento propio' })
  eliminar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eliminarEvento.execute({ actor, id });
  }
}
