import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { EstadoAsistenteDto, PreguntarDto, RespuestaAsistenteDto } from '../../application/dto/asistente.dto';
import { EstadoAsistenteUseCase } from '../../application/use-cases/estado-asistente.use-case';
import { PreguntarAsistenteUseCase } from '../../application/use-cases/preguntar-asistente.use-case';
import { AsistenteNoConfiguradoError, AsistenteSinRespuestaError } from '../../domain/respuesta';
import { LimiteFrecuenciaGuard } from './limite-frecuencia.guard';

/** Asistente IA "Ask AI" (solo administradores). Solo lectura: consulta datos mediante herramientas. */
@ApiTags('Asistente IA')
@ApiBearerAuth()
@Roles('admin')
@Controller('asistente')
export class AsistenteController {
  constructor(
    private readonly estadoUseCase: EstadoAsistenteUseCase,
    private readonly preguntarUseCase: PreguntarAsistenteUseCase,
  ) {}

  @Get('estado')
  @ApiOperation({ summary: 'Diagnóstico: si el asistente tiene clave de API y qué modelo usa' })
  @ApiOkResponse({ type: EstadoAsistenteDto })
  estado(): EstadoAsistenteDto {
    const e = this.estadoUseCase.execute();
    return { ok: true, configurado: e.configurado, modelo: e.modelo };
  }

  @Post('preguntar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LimiteFrecuenciaGuard)
  @ApiOperation({ summary: 'Pregunta al asistente (consulta datos de solo lectura mediante herramientas)' })
  @ApiOkResponse({ type: RespuestaAsistenteDto })
  @ApiServiceUnavailableResponse({ description: 'Falta DEEPSEEK_API_KEY en el entorno' })
  @ApiBadGatewayResponse({ description: 'El modelo falló o no produjo respuesta; incluye `herramientas` ejecutadas' })
  async preguntar(@CurrentUser() actor: Actor, @Body() dto: PreguntarDto): Promise<RespuestaAsistenteDto> {
    try {
      return RespuestaAsistenteDto.from(
        await this.preguntarUseCase.execute(actor, {
          pregunta: dto.pregunta,
          historial: dto.historial,
          conversacion: dto.conversacion ?? null,
        }),
      );
    } catch (e) {
      if (e instanceof AsistenteNoConfiguradoError) {
        throw new ServiceUnavailableException({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'NOT_CONFIGURED',
          message: e.message,
        });
      }
      if (e instanceof AsistenteSinRespuestaError) {
        throw new BadGatewayException({
          statusCode: HttpStatus.BAD_GATEWAY,
          code: 'ASSISTANT_ERROR',
          message: e.message,
          herramientas: e.herramientas,
        });
      }
      throw e;
    }
  }
}
