import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { CarnetDto } from '../../application/dto/carnet.dto';
import { GetCarnetUseCase } from '../../application/use-cases/carnet.use-cases';

/** Carnet digital (equivale a `controllers/Carnet.php`). */
@ApiTags('Carnet digital')
@ApiBearerAuth()
@Controller('carnet')
export class CarnetController {
  constructor(private readonly getCarnet: GetCarnetUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Datos del carnet del usuario autenticado' })
  mio(@CurrentUser() actor: Actor): Promise<CarnetDto> {
    return this.getCarnet.execute({ actor });
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Datos del carnet de un colaborador (admin, o el propio)' })
  de(@CurrentUser() actor: Actor, @Param('userId', ParseIntPipe) userId: number): Promise<CarnetDto> {
    return this.getCarnet.execute({ actor, userId });
  }
}
