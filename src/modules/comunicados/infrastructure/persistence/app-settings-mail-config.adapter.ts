import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppConfig } from '../../../../config/configuration';
import { AppSettingOrmEntity } from '../../../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { ComunicadosMailConfig, ConfigCorreoComunicados } from '../../domain/comunicados-mail-config.port';

export const CLAVES_CORREO_COMUNICADOS = {
  modo: 'comunicados_mail_mode',
  testTo: 'comunicados_mail_test_to',
  prodTo: 'comunicados_mail_prod_to',
} as const;

/**
 * Lee la configuración de correo de comunicados desde `app_settings`; si una
 * clave está vacía usa el valor de la configuración de la aplicación
 * (`COMUNICADOS_MAIL_MODE`, `COMUNICADOS_MAIL_TEST_TO`, `COMUNICADOS_MAIL_PROD_TO`).
 */
@Injectable()
export class AppSettingsMailConfig extends ComunicadosMailConfig {
  constructor(
    @InjectRepository(AppSettingOrmEntity) private readonly settings: Repository<AppSettingOrmEntity>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  async get(): Promise<ConfigCorreoComunicados> {
    const defaults = this.config.get('comunicados', { infer: true });
    const rows = await this.settings.find({ where: { setting_key: In(Object.values(CLAVES_CORREO_COMUNICADOS)) } });
    const valor = (key: string, def: string): string => {
      const v = rows.find((r) => r.setting_key === key)?.value;
      return v === null || v === undefined || v === '' ? def : v;
    };
    return {
      modo: valor(CLAVES_CORREO_COMUNICADOS.modo, defaults.mailMode) === 'produccion' ? 'produccion' : 'test',
      testTo: valor(CLAVES_CORREO_COMUNICADOS.testTo, defaults.testTo),
      prodTo: valor(CLAVES_CORREO_COMUNICADOS.prodTo, defaults.prodTo),
    };
  }
}
