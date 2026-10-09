import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsignarPuntosUseCase, ListColaboradoresUseCase } from './application/use-cases/admin.use-cases';
import {
  GetMiBalanceUseCase,
  ListMisTransaccionesUseCase,
  ListRecompensasUseCase,
} from './application/use-cases/balance.use-cases';
import {
  CanjearRecompensaUseCase,
  ListCanjesUseCase,
  ListMisCanjesUseCase,
  ResolverCanjeUseCase,
} from './application/use-cases/canjes.use-cases';
import { ColaboradorDirectory, NotificacionPublisher } from './domain/ports';
import {
  BalanceRepository,
  CanjeRepository,
  PuntosUnitOfWork,
  RecompensaRepository,
  TransaccionRepository,
} from './domain/repositories';
import { PuntosController } from './infrastructure/http/puntos.controller';
import {
  CanjeOrmEntity,
  PuntoOrmEntity,
  PuntosTransaccionOrmEntity,
  RecompensaOrmEntity,
} from './infrastructure/persistence/puntos.orm-entities';
import {
  SqlColaboradorDirectory,
  SqlNotificacionPublisher,
} from './infrastructure/persistence/typeorm-puntos.adapters';
import {
  TypeOrmBalanceRepository,
  TypeOrmCanjeRepository,
  TypeOrmPuntosUnitOfWork,
  TypeOrmRecompensaRepository,
  TypeOrmTransaccionRepository,
} from './infrastructure/persistence/typeorm-puntos.repositories';

@Module({
  imports: [
    TypeOrmModule.forFeature([PuntoOrmEntity, PuntosTransaccionOrmEntity, RecompensaOrmEntity, CanjeOrmEntity]),
  ],
  controllers: [PuntosController],
  providers: [
    // Casos de uso
    GetMiBalanceUseCase,
    ListMisTransaccionesUseCase,
    ListRecompensasUseCase,
    CanjearRecompensaUseCase,
    ListMisCanjesUseCase,
    ListCanjesUseCase,
    ResolverCanjeUseCase,
    AsignarPuntosUseCase,
    ListColaboradoresUseCase,
    // Puertos → adaptadores
    { provide: BalanceRepository, useClass: TypeOrmBalanceRepository },
    { provide: TransaccionRepository, useClass: TypeOrmTransaccionRepository },
    { provide: RecompensaRepository, useClass: TypeOrmRecompensaRepository },
    { provide: CanjeRepository, useClass: TypeOrmCanjeRepository },
    { provide: PuntosUnitOfWork, useClass: TypeOrmPuntosUnitOfWork },
    { provide: ColaboradorDirectory, useClass: SqlColaboradorDirectory },
    { provide: NotificacionPublisher, useClass: SqlNotificacionPublisher },
  ],
  exports: [BalanceRepository, TransaccionRepository],
})
export class PuntosModule {}
