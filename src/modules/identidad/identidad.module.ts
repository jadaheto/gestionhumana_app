import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingOrmEntity } from '../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import {
  GetBrandingUseCase,
  GetCertificadoLaboralConfigUseCase,
  GetCorreoComunicadosUseCase,
  SaveBrandingUseCase,
  SaveCertificadoLaboralConfigUseCase,
  SaveCorreoComunicadosUseCase,
} from './application/use-cases/configuracion.use-cases';
import { GetIdentidadUseCase, SaveIdentidadUseCase } from './application/use-cases/identidad.use-cases';
import { AppSettingsRepository } from './domain/app-settings.repository';
import { IdentidadRepository } from './domain/identidad';
import { ConfiguracionController } from './infrastructure/http/configuracion.controller';
import { IdentidadController } from './infrastructure/http/identidad.controller';
import { IdentidadOrmEntity } from './infrastructure/persistence/identidad.orm-entity';
import { TypeOrmAppSettingsRepository } from './infrastructure/persistence/typeorm-app-settings.repository';
import { TypeOrmIdentidadRepository } from './infrastructure/persistence/typeorm-identidad.repository';

/** Identidad empresarial y configuración de la aplicación (branding, correo de comunicados, certificado laboral). */
@Module({
  imports: [TypeOrmModule.forFeature([IdentidadOrmEntity, AppSettingOrmEntity])],
  controllers: [IdentidadController, ConfiguracionController],
  providers: [
    GetIdentidadUseCase,
    SaveIdentidadUseCase,
    GetBrandingUseCase,
    SaveBrandingUseCase,
    GetCorreoComunicadosUseCase,
    SaveCorreoComunicadosUseCase,
    GetCertificadoLaboralConfigUseCase,
    SaveCertificadoLaboralConfigUseCase,
    { provide: IdentidadRepository, useClass: TypeOrmIdentidadRepository },
    { provide: AppSettingsRepository, useClass: TypeOrmAppSettingsRepository },
  ],
  exports: [AppSettingsRepository],
})
export class IdentidadModule {}
