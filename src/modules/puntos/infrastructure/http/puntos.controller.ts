import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  BalanceDto,
  CanjeDto,
  ColaboradorResumenDto,
  RecompensaDto,
  TransaccionDto,
} from '../../application/dto/puntos.dto';
import { AsignarPuntosUseCase, ListColaboradoresUseCase } from '../../application/use-cases/admin.use-cases';
import {
  GetMiBalanceUseCase,
  ListMisTransaccionesUseCase,
  ListRecompensasUseCase,
} from '../../application/use-cases/balance.use-cases';
import {
  CanjearRecompensaUseCase,
  ListCanjesUseCase,
  ListMisCanjesUseCase,
  ResolverCanjeUseCase,
} from '../../application/use-cases/canjes.use-cases';
import { AsignarPuntosRequestDto, HistorialQueryDto, ListCanjesQueryDto } from './dto/puntos-request.dto';
import {
  BalanceResponseDto,
  CanjeResponseDto,
  ColaboradorResumenResponseDto,
  RecompensaResponseDto,
  TransaccionResponseDto,
} from './dto/puntos-response.dto';

/**
 * Puntos y recompensas.
 * Funcionario: su balance, historial, catálogo y canjes propios.
 * Administrador: asignar puntos, listar y resolver canjes.
 */
@ApiTags('Puntos y recompensas')
@ApiBearerAuth()
@Controller('puntos')
export class PuntosController {
  constructor(
    private readonly getMiBalance: GetMiBalanceUseCase,
    private readonly listMisTransacciones: ListMisTransaccionesUseCase,
    private readonly listRecompensas: ListRecompensasUseCase,
    private readonly canjear: CanjearRecompensaUseCase,
    private readonly listMisCanjes: ListMisCanjesUseCase,
    private readonly listCanjes: ListCanjesUseCase,
    private readonly resolverCanje: ResolverCanjeUseCase,
    private readonly asignarPuntos: AsignarPuntosUseCase,
    private readonly listColaboradores: ListColaboradoresUseCase,
  ) {}

  // ---------- Colaborador ----------
  @Get('mi-balance')
  @ApiOperation({ summary: 'Balance de puntos del usuario autenticado (se crea en cero si no existe)' })
  @ApiOkResponse({ type: BalanceResponseDto })
  miBalance(@CurrentUser() actor: Actor): Promise<BalanceDto> {
    return this.getMiBalance.execute(actor);
  }

  @Get('historial')
  @ApiOperation({ summary: 'Historial de movimientos del usuario autenticado (más recientes primero)' })
  @ApiOkResponse({ type: [TransaccionResponseDto] })
  historial(@CurrentUser() actor: Actor, @Query() query: HistorialQueryDto): Promise<TransaccionDto[]> {
    return this.listMisTransacciones.execute({ actor, limit: query.limit });
  }

  @Get('recompensas')
  @ApiOperation({ summary: 'Catálogo de recompensas activas' })
  @ApiOkResponse({ type: [RecompensaResponseDto] })
  recompensas(): Promise<RecompensaDto[]> {
    return this.listRecompensas.execute();
  }

  @Post('recompensas/:id/canjear')
  @HttpCode(201)
  @ApiOperation({ summary: 'Canjear una recompensa (descuenta puntos y crea el canje pendiente de aprobación)' })
  @ApiOkResponse({ type: CanjeResponseDto })
  canjearRecompensa(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<CanjeDto> {
    return this.canjear.execute({ actor, recompensaId: id });
  }

  @Get('mis-canjes')
  @ApiOperation({ summary: 'Canjes del usuario autenticado' })
  @ApiOkResponse({ type: [CanjeResponseDto] })
  misCanjes(@CurrentUser() actor: Actor): Promise<CanjeDto[]> {
    return this.listMisCanjes.execute(actor);
  }

  // ---------- Administración ----------
  @Get('colaboradores')
  @Roles('admin')
  @ApiOperation({ summary: 'Colaboradores activos (para asignar puntos)' })
  @ApiOkResponse({ type: [ColaboradorResumenResponseDto] })
  colaboradores(): Promise<ColaboradorResumenDto[]> {
    return this.listColaboradores.execute();
  }

  @Post('asignar')
  @Roles('admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Asignar puntos a un colaborador (crea movimiento "ganado" y notifica)' })
  @ApiOkResponse({ type: BalanceResponseDto })
  asignar(@Body() dto: AsignarPuntosRequestDto): Promise<BalanceDto> {
    return this.asignarPuntos.execute({ userId: dto.userId, cantidad: dto.cantidad, concepto: dto.concepto });
  }

  @Get('canjes')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar canjes (por defecto pendientes; `estado=todos` para todos)' })
  @ApiOkResponse({ type: [CanjeResponseDto] })
  canjes(@Query() query: ListCanjesQueryDto): Promise<CanjeDto[]> {
    return this.listCanjes.execute({ estado: query.estado ?? 'pendiente' });
  }

  @Post('canjes/:id/aprobar')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aprobar un canje pendiente' })
  @ApiOkResponse({ type: CanjeResponseDto })
  aprobar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<CanjeDto> {
    return this.resolverCanje.execute({ actor, canjeId: id, accion: 'aprobado' });
  }

  @Post('canjes/:id/rechazar')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rechazar un canje pendiente (reintegra los puntos al colaborador)' })
  @ApiOkResponse({ type: CanjeResponseDto })
  rechazar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<CanjeDto> {
    return this.resolverCanje.execute({ actor, canjeId: id, accion: 'rechazado' });
  }
}
