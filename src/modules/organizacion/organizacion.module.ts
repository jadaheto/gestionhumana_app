import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaOrmEntity } from '../../shared/infrastructure/persistence/orm/area.orm-entity';
import { CargoOrmEntity } from '../../shared/infrastructure/persistence/orm/cargo.orm-entity';
import { SedeOrmEntity } from '../../shared/infrastructure/persistence/orm/sede.orm-entity';
import { DeleteAreaUseCase, ListAreasUseCase, SaveAreaUseCase } from './application/use-cases/areas.use-cases';
import { DeleteCargoUseCase, ListCargosUseCase, SaveCargoUseCase } from './application/use-cases/cargos.use-cases';
import { DeleteSedeUseCase, ListSedesUseCase, SaveSedeUseCase } from './application/use-cases/sedes.use-cases';
import { AreaRepository, CargoRepository, SedeRepository } from './domain/repositories';
import { OrganizacionController } from './infrastructure/http/organizacion.controller';
import {
  TypeOrmAreaRepository,
  TypeOrmCargoRepository,
  TypeOrmSedeRepository,
} from './infrastructure/persistence/typeorm-organizacion.repositories';

@Module({
  imports: [TypeOrmModule.forFeature([SedeOrmEntity, AreaOrmEntity, CargoOrmEntity])],
  controllers: [OrganizacionController],
  providers: [
    ListSedesUseCase,
    SaveSedeUseCase,
    DeleteSedeUseCase,
    ListAreasUseCase,
    SaveAreaUseCase,
    DeleteAreaUseCase,
    ListCargosUseCase,
    SaveCargoUseCase,
    DeleteCargoUseCase,
    { provide: SedeRepository, useClass: TypeOrmSedeRepository },
    { provide: AreaRepository, useClass: TypeOrmAreaRepository },
    { provide: CargoRepository, useClass: TypeOrmCargoRepository },
  ],
  exports: [SedeRepository, AreaRepository, CargoRepository],
})
export class OrganizacionModule {}
