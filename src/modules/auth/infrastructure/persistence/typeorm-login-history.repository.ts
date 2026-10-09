import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginHistoryEntry, LoginHistoryRepository } from '../../domain/login-history.repository';
import { LoginHistoryOrmEntity } from './login-history.orm-entity';

@Injectable()
export class TypeOrmLoginHistoryRepository extends LoginHistoryRepository {
  constructor(@InjectRepository(LoginHistoryOrmEntity) private readonly repo: Repository<LoginHistoryOrmEntity>) {
    super();
  }

  async record(entry: LoginHistoryEntry): Promise<void> {
    await this.repo.insert({
      user_id: entry.userId,
      device: entry.device,
      location: entry.location,
      ip_address: entry.ipAddress,
    });
  }

  async findRecent(userId: number, limit: number): Promise<LoginHistoryEntry[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { login_time: 'DESC' }, take: limit });
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? userId,
      device: r.device ?? '',
      location: r.location ?? '',
      ipAddress: r.ip_address ?? '',
      loginTime: r.login_time,
    }));
  }
}
