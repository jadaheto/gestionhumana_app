import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { AppSettingOrmEntity } from '../../../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { BrandingPort } from '../../domain/ports';

/**
 * Logo oscuro de `app_settings.branding_logo_dark` (igual que `app_logo_url('dark')`).
 * El legado guardaba rutas como `uploads/branding/xxx.png`; se leen desde el
 * almacenamiento de uploads. Si no hay logo configurado o no es PNG/JPEG, null.
 */
@Injectable()
export class TypeOrmBrandingAdapter extends BrandingPort {
  private readonly logger = new Logger(TypeOrmBrandingAdapter.name);

  constructor(
    @InjectRepository(AppSettingOrmEntity) private readonly settings: Repository<AppSettingOrmEntity>,
    private readonly files: FileStorage,
  ) {
    super();
  }

  async logoOscuro(): Promise<Buffer | null> {
    try {
      const row = await this.settings.findOne({ where: { setting_key: 'branding_logo_dark' } });
      const value = (row?.value ?? '').trim().replace(/^\/+/, '');
      if (!value || !/\.(png|jpe?g)$/i.test(value)) return null;
      const relative = value.startsWith('uploads/') ? value.slice('uploads/'.length) : value;
      if (!(await this.files.exists(relative))) return null;
      return await this.files.read(relative);
    } catch (e) {
      this.logger.warn(`No se pudo leer el logo para los documentos: ${(e as Error).message}`);
      return null;
    }
  }
}
