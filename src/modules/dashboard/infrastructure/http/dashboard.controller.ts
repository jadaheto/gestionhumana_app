import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { DashboardDto } from '../../application/dto/dashboard.dto';
import { GetDashboardUseCase } from '../../application/use-cases/get-dashboard.use-case';

/** Dashboard de Gestión Humana (sustituye a `Rrhh::dashboard`). */
@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getDashboard: GetDashboardUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Dashboard según el rol del usuario',
    description:
      'Administrador: estadísticas, contratos por vencer (30 días), ranking de puntos, distribución por área/sede, cumpleaños y aniversarios. ' +
      'Funcionario: resumen de perfil, permisos, vacaciones pendientes, días en la empresa, cumpleaños y aniversarios.',
  })
  obtener(@CurrentUser() actor: Actor): Promise<DashboardDto> {
    return this.getDashboard.execute(actor);
  }
}
