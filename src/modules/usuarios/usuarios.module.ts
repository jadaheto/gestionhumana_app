import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from '../../shared/infrastructure/persistence/orm/user.orm-entity';
import {
  CreateUsuarioUseCase,
  DeleteUsuarioUseCase,
  GetUsuarioUseCase,
  ListUsuariosUseCase,
  ResetPasswordUsuarioUseCase,
  UpdateUsuarioUseCase,
} from './application/use-cases/usuarios.use-cases';
import { UsuarioRepository } from './domain/usuario.repository';
import { UsuariosController } from './infrastructure/http/usuarios.controller';
import { TypeOrmUsuarioRepository } from './infrastructure/persistence/typeorm-usuario.repository';

/** Administración de usuarios (cuentas de acceso): CRUD, roles y restablecimiento de contraseña. */
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsuariosController],
  providers: [
    ListUsuariosUseCase,
    GetUsuarioUseCase,
    CreateUsuarioUseCase,
    UpdateUsuarioUseCase,
    ResetPasswordUsuarioUseCase,
    DeleteUsuarioUseCase,
    { provide: UsuarioRepository, useClass: TypeOrmUsuarioRepository },
  ],
  exports: [UsuarioRepository],
})
export class UsuariosModule {}
