import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConexionesFeedDto } from '../../application/dto/comunicados.dto';
import { FeedConexionesUseCase } from '../../application/use-cases/conexiones.use-cases';

/** Feed de Conexiones: celebraciones del día. */
@ApiTags('Conexiones')
@ApiBearerAuth()
@Controller('conexiones')
export class ConexionesController {
  constructor(private readonly feed: FeedConexionesUseCase) {}

  @Get('feed')
  @ApiOperation({ summary: 'Cumpleaños y aniversarios laborales de hoy' })
  obtener(): Promise<ConexionesFeedDto> {
    return this.feed.execute();
  }
}
