import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioResumenDto } from '../../application/dto/colaboracion.dto';
import { ListUsuariosUseCase } from '../../application/use-cases/usuarios.use-cases';

/** Directorio básico de usuarios para selectores de colaboración. */
@ApiTags('Colaboración · Usuarios')
@ApiBearerAuth()
@Controller('colaboracion/usuarios')
export class UsuariosColaboracionController {
  constructor(private readonly listUsuarios: ListUsuariosUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Usuarios (id, nombre, email) para asignar tareas o elegir destinatarios' })
  listar(): Promise<UsuarioResumenDto[]> {
    return this.listUsuarios.execute();
  }
}
