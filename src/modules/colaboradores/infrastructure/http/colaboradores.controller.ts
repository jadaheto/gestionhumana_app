import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ColaboradorCreadoDto,
  ColaboradorDetalleDto,
  ColaboradorDto,
  ColaboradorListadoDto,
} from '../../application/dto/colaboradores.dto';
import {
  CreateColaboradorUseCase,
  DeleteColaboradorUseCase,
  GetColaboradorUseCase,
  ListColaboradoresUseCase,
  UpdateColaboradorUseCase,
  UploadFotoColaboradorUseCase,
} from '../../application/use-cases/colaboradores.use-cases';
import {
  CreateColaboradorRequestDto,
  ListColaboradoresQueryDto,
  SaveColaboradorRequestDto,
  toSaveColaboradorInput,
} from './dto/colaboradores-request.dto';

/** Administración de colaboradores (equivale a `controllers/Colaboradores.php`). Sólo administradores. */
@ApiTags('Colaboradores')
@ApiBearerAuth()
@Roles('admin')
@Controller('colaboradores')
export class ColaboradoresController {
  constructor(
    private readonly listUseCase: ListColaboradoresUseCase,
    private readonly getUseCase: GetColaboradorUseCase,
    private readonly createUseCase: CreateColaboradorUseCase,
    private readonly updateUseCase: UpdateColaboradorUseCase,
    private readonly uploadFoto: UploadFotoColaboradorUseCase,
    private readonly deleteUseCase: DeleteColaboradorUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar colaboradores (filtros: estado, área, sede)' })
  list(@Query() query: ListColaboradoresQueryDto): Promise<ColaboradorListadoDto[]> {
    return this.listUseCase.execute({ estado: query.estado, areaId: query.areaId, sedeId: query.sedeId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un colaborador con su contrato activo' })
  get(@Param('id', ParseIntPipe) id: number): Promise<ColaboradorDetalleDto> {
    return this.getUseCase.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear colaborador (devuelve usuario y contraseña temporal una sola vez)' })
  create(@Body() dto: CreateColaboradorRequestDto): Promise<ColaboradorCreadoDto> {
    return this.createUseCase.execute({
      ...toSaveColaboradorInput(dto),
      username: dto.username ?? null,
      password: dto.password ?? null,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar colaborador' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveColaboradorRequestDto): Promise<ColaboradorDto> {
    return this.updateUseCase.execute({ ...toSaveColaboradorInput(dto), id });
  }

  @Post(':id/foto')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Subir la foto del colaborador (png/jpg/jpeg/gif, máx. 5 MB)' })
  foto(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: Express.Multer.File): Promise<ColaboradorDto> {
    if (!file) throw new ValidationError('Debes adjuntar una imagen.');
    return this.uploadFoto.execute({
      id,
      content: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar colaborador (no permite eliminarse a sí mismo)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: Actor): Promise<void> {
    return this.deleteUseCase.execute({ actor, id });
  }
}
