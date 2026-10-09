import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { CorreoDto, RedactarCorreoResultado } from '../../application/dto/colaboracion.dto';
import {
  ContarCorreosNoLeidosUseCase,
  GetCorreoUseCase,
  ListBuzonUseCase,
  RedactarCorreoUseCase,
} from '../../application/use-cases/correo.use-cases';
import { RedactarCorreoRequestDto } from './dto/colaboracion-request.dto';

/** Buzón de correo interno (sustituye a `Email.php`). */
@ApiTags('Colaboración · Correo interno')
@ApiBearerAuth()
@Controller('colaboracion/correo')
export class CorreoController {
  constructor(
    private readonly listBuzon: ListBuzonUseCase,
    private readonly getCorreo: GetCorreoUseCase,
    private readonly redactar: RedactarCorreoUseCase,
    private readonly contarNoLeidos: ContarCorreosNoLeidosUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Buzón (inbox o sent)' })
  @ApiQuery({ name: 'carpeta', required: false, enum: ['inbox', 'sent'] })
  buzon(@CurrentUser() actor: Actor, @Query('carpeta') carpeta?: string): Promise<CorreoDto[]> {
    return this.listBuzon.execute({ actor, carpeta });
  }

  @Get('no-leidos')
  @ApiOperation({ summary: 'Cantidad de correos no leídos' })
  async noLeidos(@CurrentUser() actor: Actor): Promise<{ total: number }> {
    return { total: await this.contarNoLeidos.execute(actor) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver un correo propio (lo marca como leído)' })
  ver(@CurrentUser() actor: Actor, @Param('id', ParseIntPipe) id: number): Promise<CorreoDto> {
    return this.getCorreo.execute({ actor, id });
  }

  @Post()
  @ApiOperation({ summary: 'Redactar y enviar un correo interno a un usuario registrado' })
  enviar(@CurrentUser() actor: Actor, @Body() dto: RedactarCorreoRequestDto): Promise<RedactarCorreoResultado> {
    return this.redactar.execute({ actor, input: dto });
  }
}
