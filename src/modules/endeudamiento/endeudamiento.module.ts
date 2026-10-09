import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BuscarColaboradorUseCase,
  CrearSolicitudUseCase,
  GenerarNumeroSolicitudUseCase,
  GetSalarioReferenciaUseCase,
  GetSolicitudUseCase,
  ListSolicitudesUseCase,
} from './application/use-cases/endeudamiento.use-cases';
import { ColaboradorFinder, EndeudamientoRepository, SalarioReferenciaReader } from './domain/ports';
import { EndeudamientoController } from './infrastructure/http/endeudamiento.controller';
import {
  EndeudamientoConceptoOrmEntity,
  EndeudamientoSolicitudOrmEntity,
} from './infrastructure/persistence/endeudamiento.orm-entities';
import {
  TypeOrmColaboradorFinder,
  TypeOrmSalarioReferenciaReader,
} from './infrastructure/persistence/typeorm-endeudamiento.readers';
import { TypeOrmEndeudamientoRepository } from './infrastructure/persistence/typeorm-endeudamiento.repository';

/** Bounded context de evaluación de nivel de endeudamiento (sólo administración). */
@Module({
  imports: [TypeOrmModule.forFeature([EndeudamientoSolicitudOrmEntity, EndeudamientoConceptoOrmEntity])],
  controllers: [EndeudamientoController],
  providers: [
    ListSolicitudesUseCase,
    GetSolicitudUseCase,
    CrearSolicitudUseCase,
    GenerarNumeroSolicitudUseCase,
    BuscarColaboradorUseCase,
    GetSalarioReferenciaUseCase,
    { provide: EndeudamientoRepository, useClass: TypeOrmEndeudamientoRepository },
    { provide: ColaboradorFinder, useClass: TypeOrmColaboradorFinder },
    { provide: SalarioReferenciaReader, useClass: TypeOrmSalarioReferenciaReader },
  ],
})
export class EndeudamientoModule {}
