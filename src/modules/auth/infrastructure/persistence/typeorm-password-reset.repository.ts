import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PasswordReset } from '../../domain/password-reset';
import { PasswordResetRepository } from '../../domain/password-reset.repository';
import { PasswordResetOrmEntity } from './password-reset.orm-entity';

@Injectable()
export class TypeOrmPasswordResetRepository extends PasswordResetRepository {
  constructor(@InjectRepository(PasswordResetOrmEntity) private readonly repo: Repository<PasswordResetOrmEntity>) {
    super();
  }

  async createToken(email: string, token: string, expiresAt: Date, now: Date): Promise<void> {
    await this.repo.update({ email, used_at: IsNull() }, { used_at: now });
    await this.repo.insert({ email, token, expires_at: expiresAt });
  }

  async findByToken(token: string): Promise<PasswordReset | null> {
    const row = await this.repo.findOne({ where: { token } });
    if (!row) return null;
    return new PasswordReset({
      id: row.id,
      email: row.email,
      token: row.token,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    });
  }

  async markUsed(token: string, now: Date): Promise<void> {
    await this.repo.update({ token }, { used_at: now });
  }
}
