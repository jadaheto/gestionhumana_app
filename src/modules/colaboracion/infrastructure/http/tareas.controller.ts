import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { EstadisticasTareasDto, KanbanDto, TareaDto } from '../../application/dto/colaboracion.dto';
import {
  CambiarEstadoTareaUseCase,
  EliminarTareaUseCase,
  GetEstadisticasTareasUseCase,
  GetKanbanUseCase,
  GetTareaUseCase,
  GuardarTareaUseCase,
  ListTareasUseCase,
} from '../../application/use-cases/tareas.use-cases';
import { CambiarEstadoTareaRequestDto, GuardarTareaRequestDto } from './dto/colaboracion-request.dto';

/** Tareas (sustituye a `Tasks.php`). Lectura: todos; modificación: admin o creador. */
@ApiTags('Colaboración · Tareas')
@ApiBearerAuth()
@Controller('colaboracion/tareas')
export class TareasController {
  constructor(
    private readonly listTareas: ListTareasUseCase,
    private readonly getKanban: GetKanbanUseCase,
    private readonly getEstadisticas: GetEstadisticasTareasUseCase,
    private readonly getTarea: GetTareaUseCase,
    private readonly guardarTarea: GuardarTareaUseCase,
    private readonly cambiarEstado: CambiarEstadoTareaUseCase,
    private readonly eliminarTarea: EliminarTareaUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar tareas (ordenadas por fecha límite)' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'busqueda', required: false })
  listar(
    @CurrentUser() actor: Actor,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
  ): Promise<TareaDto[]> {
    return this.listTareas.execute({ actor, filtro: { estado, busqueda } });
  }

  @Get('kanban')
  @ApiOperation({ summary: 'Tareas agrupadas por estado (tablero Kanban)' })
  kanban(@CurrentUser() actor: Actor): Promise<KanbanDto> {
    return this.getKanban.execute(actor);
  }

  @Get('estadisticas')
  @ApiOperation({ summary: 'Contadores de tareas por estado' })
  estadisticas(): Promise<EstadisticasTareasDto> {
    return this.getEstadisticas.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una tarea' })
  detalle(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<TareaDto> {
    return this.getTarea.execute({ actor, id });
  }

  @Post()
  @ApiOperation({ summary: 'Crear tarea (notifica a los asignados)' })
  crear(@CurrentUser() actor: Actor, @Body() dto: GuardarTareaRequestDto): Promise<TareaDto> {
    return this.guardarTarea.execute({ actor, input: dto });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar tarea (admin o creador)' })
  editar(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarTareaRequestDto,
  ): Promise<TareaDto> {
    return this.guardarTarea.execute({ actor, input: { ...dto, id } });
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar el estado de una tarea (admin o creador)' })
  estado(
    @CurrentUser() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoTareaRequestDto,
  ): Promise<TareaDto> {
    return this.cambiarEstado.execute({ actor, id, estado: dto.estado });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar tarea (admin o creador)' })
  eliminar(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eliminarTarea.execute({ actor, id });
  }
}
