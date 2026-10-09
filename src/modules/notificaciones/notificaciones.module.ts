import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CountNoLeidasUseCase,
  CrearNotificacionUseCase,
  EliminarNotificacionUseCase,
  ListNotificacionesUseCase,
  MarcarLeidaUseCase,
  MarcarTodasLeidasUseCase,
} from './application/use-cases/notificaciones.use-cases';
import { NotificacionRepository } from './domain/notificacion.repository';
import { NotificacionesController } from './infrastructure/http/notificaciones.controller';
import { NotificacionOrmEntity } from './infrastructure/persistence/notificacion.orm-entity';
import { TypeOrmNotificacionRepository } from './infrastructure/persistence/typeorm-notificacion.repository';

@Module({
  imports: [TypeOrmModule.forFeature([NotificacionOrmEntity])],
  controllers: [NotificacionesController],
  providers: [
    ListNotificacionesUseCase,
    CountNoLeidasUseCase,
    MarcarLeidaUseCase,
    MarcarTodasLeidasUseCase,
    EliminarNotificacionUseCase,
    CrearNotificacionUseCase,
    { provide: NotificacionRepository, useClass: TypeOrmNotificacionRepository },
  ],
  // Otros módulos pueden inyectar el repositorio o el caso de uso de creación si prefieren no insertar por SQL.
  exports: [NotificacionRepository, CrearNotificacionUseCase],
})
export class NotificacionesModule {}
