import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { Page } from '../../../../shared/domain/pagination';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { ComunicadoDto, ComunicadoFeedItemDto } from '../../application/dto/comunicados.dto';
import { FeedComunicadosUseCase, GetComunicadoUseCase } from '../../application/use-cases/comunicados.use-cases';
import { FeedQueryDto } from './dto/comunicados-request.dto';

/** Lectura de comunicados para todos los usuarios autenticados. */
@ApiTags('Comunicados')
@ApiBearerAuth()
@Controller('comunicados')
export class ComunicadosController {
  constructor(
    private readonly feed: FeedComunicadosUseCase,
    private readonly detalle: GetComunicadoUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Feed paginado de comunicados publicados' })
  listar(@Query() query: FeedQueryDto): Promise<Page<ComunicadoFeedItemDto>> {
    return this.feed.execute({ page: query.page, size: query.size });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un comunicado (los borradores sólo para administradores)' })
  ver(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: Actor): Promise<ComunicadoDto> {
    return this.detalle.execute({ id, actor });
  }
}
