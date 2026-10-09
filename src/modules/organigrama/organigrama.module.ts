import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BuscarDirectorioUseCase,
  GetJerarquiaUseCase,
  ImportarCargosUseCase,
} from './application/use-cases/organigrama.use-cases';
import { DirectorioRepository, ImportacionCargosRepository, OrganigramaRepository } from './domain/repositories';
import { OrganigramaController } from './infrastructure/http/organigrama.controller';
import { CargoSalarioOrmEntity } from './infrastructure/persistence/cargo-salario.orm-entity';
import { OrganigramaOrmEntity } from './infrastructure/persistence/organigrama.orm-entity';
import {
  TypeOrmDirectorioRepository,
  TypeOrmImportacionCargosRepository,
  TypeOrmOrganigramaRepository,
} from './infrastructure/persistence/typeorm-organigrama.repositories';

/** Organigrama, directorio de colaboradores e importador de cargos/áreas. */
@Module({
  imports: [TypeOrmModule.forFeature([OrganigramaOrmEntity, CargoSalarioOrmEntity])],
  controllers: [OrganigramaController],
  providers: [
    GetJerarquiaUseCase,
    BuscarDirectorioUseCase,
    ImportarCargosUseCase,
    { provide: OrganigramaRepository, useClass: TypeOrmOrganigramaRepository },
    { provide: DirectorioRepository, useClass: TypeOrmDirectorioRepository },
    { provide: ImportacionCargosRepository, useClass: TypeOrmImportacionCargosRepository },
  ],
})
export class OrganigramaModule {}
