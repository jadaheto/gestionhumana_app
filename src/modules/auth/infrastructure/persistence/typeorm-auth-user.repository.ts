import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { AuthUser, UiPreferences } from '../../domain/auth-user';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { AuthUserMapper } from './auth-user.mapper';

@Injectable()
export class TypeOrmAuthUserRepository extends AuthUserRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {
    super();
  }

  async findByUsernameOrEmail(identifier: string): Promise<AuthUser | null> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .where('u.email = :id OR u.username = :id', { id: identifier })
      .getMany();
    // Igual que el legado: sólo autentica si la coincidencia es única.
    return rows.length === 1 ? AuthUserMapper.toDomain(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: email.toLowerCase() })
      .getMany();
    return rows.length === 1 ? AuthUserMapper.toDomain(rows[0]) : null;
  }

  async findById(id: number): Promise<AuthUser | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? AuthUserMapper.toDomain(row) : null;
  }

  async updateEstadoColaborador(userId: number, estado: 'activo' | 'inactivo'): Promise<void> {
    await this.repo.update({ id: userId }, { estado_colaborador: estado, updated_at: new Date() });
  }

  async updatePasswordHash(userId: number, hash: string): Promise<void> {
    await this.repo.update({ id: userId }, { password: hash, updated_at: new Date() });
  }

  async updateUiPreferences(userId: number, prefs: UiPreferences): Promise<void> {
    await this.repo.update({ id: userId }, { ui_preferences: prefs });
  }
}
