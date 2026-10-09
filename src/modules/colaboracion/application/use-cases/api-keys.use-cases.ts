import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { TokenGenerator } from '../../../../shared/application/ports/token-generator.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName } from '../../../../shared/domain/actor';
import { NotFoundError, ValidationError } from '../../../../shared/domain/domain-error';
import { ApiKey, alternarEstado } from '../../domain/api-key';
import { ApiKeyRepository } from '../../domain/repositories';
import { ApiKeyDto } from '../dto/colaboracion.dto';

const toDto = (k: ApiKey, actor: Actor): ApiKeyDto => ({
  id: k.id,
  nombre: k.nombre,
  clave: k.clave,
  estado: k.estado,
  createdAt: k.createdAt,
  creadoPor: actorFullName(actor),
});

/** Clave en mayúsculas de 32 caracteres hexadecimales (igual que `Apikey_model::generate_api_key`). */
function generarClave(tokens: TokenGenerator): string {
  return tokens.random(16).toUpperCase();
}

function validarNombre(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim();
  if (n === '') throw new ValidationError('El nombre de la clave API es obligatorio.');
  if (n.length > 255) throw new ValidationError('El nombre no puede superar 255 caracteres.');
  return n;
}

@Injectable()
export class ListApiKeysUseCase implements UseCase<Actor, ApiKeyDto[]> {
  constructor(private readonly keys: ApiKeyRepository) {}
  async execute(actor: Actor): Promise<ApiKeyDto[]> {
    return (await this.keys.findByUsuario(actor.id)).map((k) => toDto(k, actor));
  }
}

@Injectable()
export class CrearApiKeyUseCase implements UseCase<{ actor: Actor; nombre: string }, ApiKeyDto> {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}
  async execute({ actor, nombre }: { actor: Actor; nombre: string }): Promise<ApiKeyDto> {
    const creada = await this.keys.crear(
      actor.id,
      validarNombre(nombre),
      generarClave(this.tokens),
      this.clock.now().toISOString(),
    );
    return toDto(creada, actor);
  }
}

@Injectable()
export class RenombrarApiKeyUseCase implements UseCase<{ actor: Actor; id: number; nombre: string }, ApiKeyDto> {
  constructor(private readonly keys: ApiKeyRepository) {}
  async execute({ actor, id, nombre }: { actor: Actor; id: number; nombre: string }): Promise<ApiKeyDto> {
    const key = await propia(this.keys, id, actor);
    const n = validarNombre(nombre);
    await this.keys.actualizarNombre(id, n);
    return toDto({ ...key, nombre: n }, actor);
  }
}

@Injectable()
export class RegenerarApiKeyUseCase implements UseCase<{ actor: Actor; id: number }, ApiKeyDto> {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly tokens: TokenGenerator,
  ) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<ApiKeyDto> {
    const key = await propia(this.keys, id, actor);
    const clave = generarClave(this.tokens);
    await this.keys.actualizarClave(id, clave);
    return toDto({ ...key, clave }, actor);
  }
}

@Injectable()
export class AlternarEstadoApiKeyUseCase implements UseCase<{ actor: Actor; id: number }, ApiKeyDto> {
  constructor(private readonly keys: ApiKeyRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<ApiKeyDto> {
    const key = await propia(this.keys, id, actor);
    const estado = alternarEstado(key.estado);
    await this.keys.actualizarEstado(id, estado);
    return toDto({ ...key, estado }, actor);
  }
}

@Injectable()
export class EliminarApiKeysUseCase implements UseCase<{ actor: Actor; ids: number[] }, { eliminadas: number }> {
  constructor(private readonly keys: ApiKeyRepository) {}
  async execute({ actor, ids }: { actor: Actor; ids: number[] }): Promise<{ eliminadas: number }> {
    const unicos = Array.from(new Set(ids.filter((i) => Number.isInteger(i) && i > 0)));
    if (unicos.length === 0) throw new ValidationError('Debes indicar al menos una clave a eliminar.');
    return { eliminadas: await this.keys.eliminar(unicos, actor.id) };
  }
}

async function propia(keys: ApiKeyRepository, id: number, actor: Actor): Promise<ApiKey> {
  const key = await keys.findOne(id, actor.id);
  if (!key) throw new NotFoundError('Clave API', id);
  return key;
}
