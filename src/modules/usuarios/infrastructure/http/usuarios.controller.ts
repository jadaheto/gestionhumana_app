import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import { PasswordRestablecidaDto, UsuarioCreadoDto, UsuarioDto } from '../../application/dto/usuarios.dto';
import {
  CreateUsuarioUseCase,
  DeleteUsuarioUseCase,
  GetUsuarioUseCase,
  ListUsuariosUseCase,
  ResetPasswordUsuarioUseCase,
  UpdateUsuarioUseCase,
} from '../../application/use-cases/usuarios.use-cases';
import {
  CreateUsuarioRequestDto,
  ResetPasswordUsuarioRequestDto,
  UpdateUsuarioRequestDto,
} from './dto/usuarios-request.dto';

/** Administración de cuentas de acceso (equivale a `AdminUsuarios` del legado). Sólo administradores. */
@ApiTags('Usuarios')
@ApiBearerAuth()
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly listar: ListUsuariosUseCase,
    private readonly obtener: GetUsuarioUseCase,
    private readonly crear: CreateUsuarioUseCase,
    private readonly actualizar: UpdateUsuarioUseCase,
    private readonly restablecer: ResetPasswordUsuarioUseCase,
    private readonly eliminar: DeleteUsuarioUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios del sistema (con sede, área y cargo)' })
  lista(): Promise<UsuarioDto[]> {
    return this.listar.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario' })
  detalle(@Param('id', ParseIntPipe) id: number): Promise<UsuarioDto> {
    return this.obtener.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear usuario (devuelve la contraseña temporal una sola vez si no se indicó una)' })
  crearUsuario(@Body() dto: CreateUsuarioRequestDto): Promise<UsuarioCreadoDto> {
    return this.crear.execute({
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      password: dto.password ?? null,
      sedeId: dto.sedeId ?? null,
      areaId: dto.areaId ?? null,
      cargoId: dto.cargoId ?? null,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar usuario (el username no cambia)' })
  editarUsuario(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioRequestDto): Promise<UsuarioDto> {
    return this.actualizar.execute({
      id,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      sedeId: dto.sedeId ?? null,
      areaId: dto.areaId ?? null,
      cargoId: dto.cargoId ?? null,
    });
  }

  @Post(':id/restablecer-contrasena')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer contraseña (indicada ≥ 8 caracteres o temporal generada)' })
  restablecerContrasena(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordUsuarioRequestDto,
  ): Promise<PasswordRestablecidaDto> {
    return this.restablecer.execute({ id, newPassword: dto.newPassword ?? null });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar usuario (no se permite eliminarse a sí mismo)' })
  eliminarUsuario(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: Actor): Promise<void> {
    return this.eliminar.execute({ id, actor });
  }
}
