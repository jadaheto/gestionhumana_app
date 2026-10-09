import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiKey, EstadoApiKey } from '../../domain/api-key';
import { ApiKeyRepository } from '../../domain/repositories';
import { ApiKeyOrmEntity } from './api-key.orm-entity';
import { toIso } from './fechas';

const toApiKey = (r: ApiKeyOrmEntity): ApiKey => ({
  id: r.id,
  userId: r.user_id,
  nombre: r.key_name,
  clave: r.generated_key,
  estado: r.status === 'Inactive' ? 'Inactive' : 'Active',
  createdAt: toIso(r.created_at) ?? '',
});

@Injectable()
export class TypeOrmApiKeyRepository extends ApiKeyRepository {
  constructor(@InjectRepository(ApiKeyOrmEntity) private readonly repo: Repository<ApiKeyOrmEntity>) {
    super();
  }

  async findByUsuario(userId: number): Promise<ApiKey[]> {
    return (await this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC', id: 'DESC' } })).map(
      toApiKey,
    );
  }

  async findOne(id: number, userId: number): Promise<ApiKey | null> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    return row ? toApiKey(row) : null;
  }

  async crear(userId: number, nombre: string, clave: string, now: string): Promise<ApiKey> {
    const saved = await this.repo.save(
      this.repo.create({
        user_id: userId,
        key_name: nombre,
        generated_key: clave,
        status: 'Active',
        created_at: new Date(now),
      }),
    );
    return toApiKey(saved);
  }

  async actualizarNombre(id: number, nombre: string): Promise<void> {
    await this.repo.update({ id }, { key_name: nombre });
  }

  async actualizarClave(id: number, clave: string): Promise<void> {
    await this.repo.update({ id }, { generated_key: clave });
  }

  async actualizarEstado(id: number, estado: EstadoApiKey): Promise<void> {
    await this.repo.update({ id }, { status: estado });
  }

  async eliminar(ids: number[], userId: number): Promise<number> {
    const result = await this.repo.delete({ id: In(ids), user_id: userId });
    return result.affected ?? 0;
  }
}
