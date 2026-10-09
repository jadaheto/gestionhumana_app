import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppSettingOrmEntity } from '../../../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { AppSettingsRepository } from '../../domain/app-settings.repository';

/** `app_settings` mediante la entidad ORM central. */
@Injectable()
export class TypeOrmAppSettingsRepository extends AppSettingsRepository {
  constructor(@InjectRepository(AppSettingOrmEntity) private readonly repo: Repository<AppSettingOrmEntity>) {
    super();
  }

  async get(key: string, defaultValue: string): Promise<string> {
    const row = await this.repo.findOne({ where: { setting_key: key } });
    return row?.value === null || row?.value === undefined || row.value === '' ? defaultValue : row.value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.save(this.repo.create({ setting_key: key, value, updated_at: new Date() }));
  }

  async getMany(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = Object.fromEntries(keys.map((k) => [k, null]));
    if (keys.length === 0) return result;
    const rows = await this.repo.find({ where: { setting_key: In(keys) } });
    for (const r of rows) result[r.setting_key] = r.value === '' ? null : r.value;
    return result;
  }
}
