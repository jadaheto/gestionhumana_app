import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { ContadorNoLeidasDto, ListaNotificacionesDto } from '../../application/dto/notificaciones.dto';
import {
  CountNoLeidasUseCase,
  EliminarNotificacionUseCase,
  ListNotificacionesUseCase,
  MarcarLeidaUseCase,
  MarcarTodasLeidasUseCase,
} from '../../application/use-cases/notificaciones.use-cases';
import { ListNotificacionesQueryDto } from './dto/notificaciones-request.dto';
import {
  ContadorNoLeidasResponseDto,
  ListaNotificacionesResponseDto,
  MarcadasResponseDto,
} from './dto/notificaciones-response.dto';

/** Notificaciones del usuario autenticado (campana del topbar y página de lista). */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly listar: ListNotificacionesUseCase,
    private readonly contar: CountNoLeidasUseCase,
    private readonly marcarLeida: MarcarLeidaUseCase,
    private readonly marcarTodas: MarcarTodasLeidasUseCase,
    private readonly eliminar: EliminarNotificacionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Últimas notificaciones propias con el total de no leídas' })
  @ApiOkResponse({ type: ListaNotificacionesResponseDto })
  lista(@CurrentUser() actor: Actor, @Query() query: ListNotificacionesQueryDto): Promise<ListaNotificacionesDto> {
    return this.listar.execute({ actor, limit: query.limit, soloNoLeidas: query.soloNoLeidas });
  }

  @Get('no-leidas')
  @ApiOperation({ summary: 'Contador de notificaciones no leídas (sondeo de la campana)' })
  @ApiOkResponse({ type: ContadorNoLeidasResponseDto })
  noLeidas(@CurrentUser() actor: Actor): Promise<ContadorNoLeidasDto> {
    return this.contar.execute(actor);
  }

  @Patch('marcar-todas')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar todas las notificaciones propias como leídas' })
  @ApiOkResponse({ type: MarcadasResponseDto })
  todas(@CurrentUser() actor: Actor): Promise<{ marcadas: number }> {
    return this.marcarTodas.execute(actor);
  }

  @Patch(':id/leida')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marcar una notificación propia como leída' })
  leida(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.marcarLeida.execute({ actor, id });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una notificación propia' })
  borrar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eliminar.execute({ actor, id });
  }
}
