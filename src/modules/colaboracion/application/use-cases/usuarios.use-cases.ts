import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { UsuariosPort } from '../../domain/usuarios.port';
import { UsuarioResumenDto } from '../dto/colaboracion.dto';

/** Directorio básico de usuarios para selectores (asignados de tareas, destinatarios de correo). */
@Injectable()
export class ListUsuariosUseCase implements UseCase<void, UsuarioResumenDto[]> {
  constructor(private readonly usuarios: UsuariosPort) {}
  execute(): Promise<UsuarioResumenDto[]> {
    return this.usuarios.listar();
  }
}
