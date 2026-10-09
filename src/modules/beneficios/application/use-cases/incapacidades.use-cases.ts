import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { Incapacidad } from '../../domain/incapacidad';
import { UsuariosPort } from '../../domain/ports';
import { IncapacidadRepository } from '../../domain/repositories';
import { ColaboradorDto, IncapacidadDto, RegistrarIncapacidadInput } from '../dto/beneficios.dto';
import { toIncapacidadDto } from '../mappers';

/** Carpeta y restricciones del soporte de incapacidades (mismas que el legado). */
export const INCAPACIDADES_FOLDER = 'incapacidades';
export const INCAPACIDADES_EXTENSIONES = ['gif', 'jpg', 'jpeg', 'png', 'pdf'];
export const INCAPACIDADES_MAX_BYTES = 5 * 1024 * 1024;

/** El administrador ve todas las incapacidades (con colaborador); el funcionario sólo las suyas. */
@Injectable()
export class ListarIncapacidadesUseCase implements UseCase<Actor, IncapacidadDto[]> {
  constructor(private readonly incapacidades: IncapacidadRepository) {}

  async execute(actor: Actor): Promise<IncapacidadDto[]> {
    if (isAdmin(actor)) {
      return (await this.incapacidades.findAll()).map((r) => toIncapacidadDto(r.incapacidad, r.colaborador));
    }
    return (await this.incapacidades.findByUser(actor.id)).map((i) => toIncapacidadDto(i));
  }
}

/**
 * Registrar una incapacidad. El administrador puede indicar el colaborador;
 * el funcionario siempre la registra sobre sí mismo (se ignora `userId`).
 */
@Injectable()
export class RegistrarIncapacidadUseCase implements UseCase<RegistrarIncapacidadInput, IncapacidadDto> {
  constructor(
    private readonly incapacidades: IncapacidadRepository,
    private readonly usuarios: UsuariosPort,
    private readonly files: FileStorage,
  ) {}

  async execute(input: RegistrarIncapacidadInput): Promise<IncapacidadDto> {
    const userId = isAdmin(input.actor) && input.userId ? input.userId : input.actor.id;
    if (userId !== input.actor.id && !(await this.usuarios.exists(userId))) {
      throw new NotFoundError('Colaborador', userId);
    }

    let archivoSoporte: string | null = null;
    if (input.archivo) {
      const stored = await this.files.save(input.archivo.buffer, {
        folder: INCAPACIDADES_FOLDER,
        originalName: input.archivo.originalName,
        mimeType: input.archivo.mimeType,
        allowedExtensions: INCAPACIDADES_EXTENSIONES,
        maxBytes: INCAPACIDADES_MAX_BYTES,
      });
      archivoSoporte = stored.relativePath;
    }

    const incapacidad = Incapacidad.create({
      userId,
      tipo: input.tipo,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      dias: input.dias ?? null,
      entidadEmisora: input.entidadEmisora ?? null,
      numeroIncapacidad: input.numeroIncapacidad ?? null,
      archivoSoporte,
    });
    return toIncapacidadDto(await this.incapacidades.save(incapacidad));
  }
}

/** Colaboradores para el select de administración (id, nombre completo, cédula). */
@Injectable()
export class ListarColaboradoresUseCase implements UseCase<void, ColaboradorDto[]> {
  constructor(private readonly usuarios: UsuariosPort) {}

  execute(): Promise<ColaboradorDto[]> {
    return this.usuarios.findColaboradores();
  }
}
