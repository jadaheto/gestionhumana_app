import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfig } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AsistenciaModule } from './modules/asistencia/asistencia.module';
import { AsistenteModule } from './modules/asistente/asistente.module';
import { AuthModule } from './modules/auth/auth.module';
import { BeneficiosModule } from './modules/beneficios/beneficios.module';
import { ColaboracionModule } from './modules/colaboracion/colaboracion.module';
import { ColaboradoresModule } from './modules/colaboradores/colaboradores.module';
import { ComunicadosModule } from './modules/comunicados/comunicados.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EndeudamientoModule } from './modules/endeudamiento/endeudamiento.module';
import { IdentidadModule } from './modules/identidad/identidad.module';
import { NominaModule } from './modules/nomina/nomina.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { OrganigramaModule } from './modules/organigrama/organigrama.module';
import { OrganizacionModule } from './modules/organizacion/organizacion.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { DomainExceptionFilter } from './shared/infrastructure/http/filters/domain-exception.filter';
import { JwtAuthGuard } from './shared/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from './shared/infrastructure/http/guards/roles.guard';
import { buildTypeOrmOptions } from './shared/infrastructure/persistence/typeorm.config';
import { SharedModule } from './shared/infrastructure/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => buildTypeOrmOptions(config),
    }),
    SharedModule,
    // --- Módulos de negocio (bounded contexts) ---
    AuthModule,
    OrganizacionModule,
    UsuariosModule,
    OrganigramaModule,
    ColaboradoresModule,
    ContratosModule,
    BeneficiosModule,
    NotificacionesModule,
    ComunicadosModule,
    IdentidadModule,
    NominaModule,
    AsistenciaModule,
    EndeudamientoModule,
    DashboardModule,
    ColaboracionModule,
    AsistenteModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
