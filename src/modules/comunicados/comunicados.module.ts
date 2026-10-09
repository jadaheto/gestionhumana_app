import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingOrmEntity } from '../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { UserOrmEntity } from '../../shared/infrastructure/persistence/orm/user.orm-entity';
import { ComunicadoMailerService } from './application/services/comunicado-mailer.service';
import { PublicacionComunicadoService } from './application/services/publicacion.service';
import {
  ActualizarComunicadoUseCase,
  CrearComunicadoUseCase,
  EliminarComunicadoUseCase,
  FeedComunicadosUseCase,
  GetComunicadoUseCase,
  ListComunicadosAdminUseCase,
  PublicarComunicadoUseCase,
  ReenviarCorreoComunicadoUseCase,
} from './application/use-cases/comunicados.use-cases';
import { FeedConexionesUseCase } from './application/use-cases/conexiones.use-cases';
import { ComunicadoRepository } from './domain/comunicado.repository';
import { ComunicadosMailConfig } from './domain/comunicados-mail-config.port';
import { ConexionesRepository } from './domain/conexiones.repository';
import { NotificacionesPort } from './domain/notificaciones.port';
import { AdminComunicadosController } from './infrastructure/http/admin-comunicados.controller';
import { ComunicadosController } from './infrastructure/http/comunicados.controller';
import { ConexionesController } from './infrastructure/http/conexiones.controller';
import { AppSettingsMailConfig } from './infrastructure/persistence/app-settings-mail-config.adapter';
import { ComunicadoMedioOrmEntity } from './infrastructure/persistence/comunicado-medio.orm-entity';
import { ComunicadoOrmEntity } from './infrastructure/persistence/comunicado.orm-entity';
import { TypeOrmComunicadoRepository } from './infrastructure/persistence/typeorm-comunicado.repository';
import { TypeOrmConexionesRepository } from './infrastructure/persistence/typeorm-conexiones.repository';
import { TypeOrmNotificacionesAdapter } from './infrastructure/persistence/typeorm-notificaciones.adapter';

/** Comunicados internos (admin + feed), correo de publicación y feed de Conexiones. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ComunicadoOrmEntity, ComunicadoMedioOrmEntity, UserOrmEntity, AppSettingOrmEntity]),
  ],
  controllers: [ComunicadosController, AdminComunicadosController, ConexionesController],
  providers: [
    ListComunicadosAdminUseCase,
    GetComunicadoUseCase,
    FeedComunicadosUseCase,
    CrearComunicadoUseCase,
    ActualizarComunicadoUseCase,
    PublicarComunicadoUseCase,
    ReenviarCorreoComunicadoUseCase,
    EliminarComunicadoUseCase,
    FeedConexionesUseCase,
    ComunicadoMailerService,
    PublicacionComunicadoService,
    { provide: ComunicadoRepository, useClass: TypeOrmComunicadoRepository },
    { provide: ConexionesRepository, useClass: TypeOrmConexionesRepository },
    { provide: NotificacionesPort, useClass: TypeOrmNotificacionesAdapter },
    { provide: ComunicadosMailConfig, useClass: AppSettingsMailConfig },
  ],
  exports: [ComunicadoRepository],
})
export class ComunicadosModule {}
