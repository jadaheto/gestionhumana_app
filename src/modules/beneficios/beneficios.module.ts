import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ListarColaboradoresUseCase,
  ListarIncapacidadesUseCase,
  RegistrarIncapacidadUseCase,
} from './application/use-cases/incapacidades.use-cases';
import {
  AprobarSolicitudUseCase,
  CrearSolicitudUseCase,
  EsJefeUseCase,
  ListarMisSolicitudesUseCase,
  ListarSolicitudesAdminUseCase,
  ListarSolicitudesJefeUseCase,
  RechazarSolicitudUseCase,
  ResolverSolicitudComoJefeUseCase,
  SuspenderVacacionesUseCase,
} from './application/use-cases/solicitudes.use-cases';
import { GetResumenVacacionesUseCase, ListarVacacionesUseCase } from './application/use-cases/vacaciones.use-cases';
import { DiasHabilesCalculator } from './domain/dias-habiles.calculator';
import { NotificacionesPort, UsuariosPort } from './domain/ports';
import {
  IncapacidadRepository,
  PermisoRepository,
  VacacionesSuspensionRepository,
  VacacionRepository,
} from './domain/repositories';
import { VacacionesSaldoCalculator } from './domain/vacaciones-saldo';
import { BeneficiosController } from './infrastructure/http/beneficios.controller';
import { SolicitudesController } from './infrastructure/http/solicitudes.controller';
import {
  IncapacidadOrmEntity,
  PermisoOrmEntity,
  VacacionDetalleOrmEntity,
  VacacionesSuspensionOrmEntity,
  VacacionOrmEntity,
} from './infrastructure/persistence/beneficios.orm-entity';
import {
  TypeOrmIncapacidadRepository,
  TypeOrmPermisoRepository,
  TypeOrmVacacionesSuspensionRepository,
  TypeOrmVacacionRepository,
} from './infrastructure/persistence/typeorm-beneficios.repositories';
import { TypeOrmNotificacionesAdapter } from './infrastructure/persistence/typeorm-notificaciones.adapter';
import { TypeOrmUsuariosAdapter } from './infrastructure/persistence/typeorm-usuarios.adapter';

/**
 * Beneficios y solicitudes: permisos, vacaciones (saldo, aprobación, suspensión)
 * e incapacidades. Migra `Solicitudes.php`, `Beneficios.php`, `Solicitud_model`,
 * `Beneficio_model`, `Vacaciones_model` y `MiPuesto::vacaciones_pendientes`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermisoOrmEntity,
      IncapacidadOrmEntity,
      VacacionOrmEntity,
      VacacionDetalleOrmEntity,
      VacacionesSuspensionOrmEntity,
    ]),
  ],
  controllers: [SolicitudesController, BeneficiosController],
  providers: [
    // Servicios de dominio (puros)
    { provide: DiasHabilesCalculator, useFactory: () => new DiasHabilesCalculator() },
    {
      provide: VacacionesSaldoCalculator,
      useFactory: (calc: DiasHabilesCalculator) => new VacacionesSaldoCalculator(calc),
      inject: [DiasHabilesCalculator],
    },
    // Casos de uso
    CrearSolicitudUseCase,
    ListarMisSolicitudesUseCase,
    ListarSolicitudesAdminUseCase,
    AprobarSolicitudUseCase,
    RechazarSolicitudUseCase,
    ListarSolicitudesJefeUseCase,
    ResolverSolicitudComoJefeUseCase,
    EsJefeUseCase,
    SuspenderVacacionesUseCase,
    GetResumenVacacionesUseCase,
    ListarVacacionesUseCase,
    ListarIncapacidadesUseCase,
    RegistrarIncapacidadUseCase,
    ListarColaboradoresUseCase,
    // Puertos → adaptadores
    { provide: PermisoRepository, useClass: TypeOrmPermisoRepository },
    { provide: VacacionesSuspensionRepository, useClass: TypeOrmVacacionesSuspensionRepository },
    { provide: IncapacidadRepository, useClass: TypeOrmIncapacidadRepository },
    { provide: VacacionRepository, useClass: TypeOrmVacacionRepository },
    { provide: UsuariosPort, useClass: TypeOrmUsuariosAdapter },
    { provide: NotificacionesPort, useClass: TypeOrmNotificacionesAdapter },
  ],
  exports: [PermisoRepository, VacacionesSuspensionRepository, DiasHabilesCalculator],
})
export class BeneficiosModule {}
