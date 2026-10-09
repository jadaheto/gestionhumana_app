import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from '../../shared/infrastructure/persistence/orm/user.orm-entity';
import { GetCarnetUseCase } from './application/use-cases/carnet.use-cases';
import {
  CreateColaboradorUseCase,
  DeleteColaboradorUseCase,
  GetColaboradorUseCase,
  ListColaboradoresUseCase,
  UpdateColaboradorUseCase,
  UploadFotoColaboradorUseCase,
} from './application/use-cases/colaboradores.use-cases';
import {
  DeleteEducacionFormalUseCase,
  DeleteEducacionNoFormalUseCase,
  DeleteExperienciaLaboralUseCase,
  DeleteFamiliarUseCase,
  GetDatosBasicosUseCase,
  ListEducacionFormalUseCase,
  ListEducacionNoFormalUseCase,
  ListExperienciaLaboralUseCase,
  ListFamiliaresUseCase,
  SaveEducacionFormalUseCase,
  SaveEducacionNoFormalUseCase,
  SaveExperienciaLaboralUseCase,
  SaveFamiliarUseCase,
  UpdateDatosBasicosUseCase,
} from './application/use-cases/info-personal.use-cases';
import {
  ChangePasswordUseCase,
  GetPerfilUseCase,
  UpdateExperienceUseCase,
  UpdatePerfilUseCase,
  UpdatePortafolioUseCase,
  UpdatePrivacySettingsUseCase,
  UploadPerfilImageUseCase,
} from './application/use-cases/perfil.use-cases';
import { ColaboradorRepository } from './domain/colaborador.repository';
import {
  DatosBasicosRepository,
  EducacionFormalRepository,
  EducacionNoFormalRepository,
  ExperienciaLaboralRepository,
  FamiliarRepository,
} from './domain/info-personal';
import { PerfilRepository } from './domain/perfil';
import { BrandingReader, ContratoActivoReader, LoginHistoryReader, PuntosInitializer } from './domain/ports';
import { CarnetController } from './infrastructure/http/carnet.controller';
import { ColaboradoresController } from './infrastructure/http/colaboradores.controller';
import { InfoPersonalController } from './infrastructure/http/info-personal.controller';
import { PerfilController } from './infrastructure/http/perfil.controller';
import {
  EducacionFormalOrmEntity,
  EducacionNoFormalOrmEntity,
  ExperienciaLaboralOrmEntity,
  FamiliarOrmEntity,
} from './infrastructure/persistence/info-personal.orm-entities';
import { TypeOrmColaboradorRepository } from './infrastructure/persistence/typeorm-colaborador.repository';
import {
  TypeOrmDatosBasicosRepository,
  TypeOrmEducacionFormalRepository,
  TypeOrmEducacionNoFormalRepository,
  TypeOrmExperienciaLaboralRepository,
  TypeOrmFamiliarRepository,
} from './infrastructure/persistence/typeorm-info-personal.repositories';
import { TypeOrmPerfilRepository } from './infrastructure/persistence/typeorm-perfil.repository';
import {
  SqlBrandingReader,
  SqlContratoActivoReader,
  SqlLoginHistoryReader,
  SqlPuntosInitializer,
} from './infrastructure/persistence/typeorm-ports.adapters';

/**
 * Contexto "Colaboradores": administración de colaboradores, información
 * personal, carnet digital y perfil del usuario.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      EducacionFormalOrmEntity,
      EducacionNoFormalOrmEntity,
      FamiliarOrmEntity,
      ExperienciaLaboralOrmEntity,
    ]),
  ],
  controllers: [ColaboradoresController, InfoPersonalController, CarnetController, PerfilController],
  providers: [
    // Casos de uso: colaboradores
    ListColaboradoresUseCase,
    GetColaboradorUseCase,
    CreateColaboradorUseCase,
    UpdateColaboradorUseCase,
    UploadFotoColaboradorUseCase,
    DeleteColaboradorUseCase,
    // Casos de uso: información personal
    GetDatosBasicosUseCase,
    UpdateDatosBasicosUseCase,
    ListEducacionFormalUseCase,
    SaveEducacionFormalUseCase,
    DeleteEducacionFormalUseCase,
    ListEducacionNoFormalUseCase,
    SaveEducacionNoFormalUseCase,
    DeleteEducacionNoFormalUseCase,
    ListFamiliaresUseCase,
    SaveFamiliarUseCase,
    DeleteFamiliarUseCase,
    ListExperienciaLaboralUseCase,
    SaveExperienciaLaboralUseCase,
    DeleteExperienciaLaboralUseCase,
    // Casos de uso: carnet y perfil
    GetCarnetUseCase,
    GetPerfilUseCase,
    UpdatePerfilUseCase,
    UpdatePortafolioUseCase,
    UploadPerfilImageUseCase,
    ChangePasswordUseCase,
    UpdatePrivacySettingsUseCase,
    UpdateExperienceUseCase,
    // Puertos → adaptadores
    { provide: ColaboradorRepository, useClass: TypeOrmColaboradorRepository },
    { provide: DatosBasicosRepository, useClass: TypeOrmDatosBasicosRepository },
    { provide: EducacionFormalRepository, useClass: TypeOrmEducacionFormalRepository },
    { provide: EducacionNoFormalRepository, useClass: TypeOrmEducacionNoFormalRepository },
    { provide: FamiliarRepository, useClass: TypeOrmFamiliarRepository },
    { provide: ExperienciaLaboralRepository, useClass: TypeOrmExperienciaLaboralRepository },
    { provide: PerfilRepository, useClass: TypeOrmPerfilRepository },
    { provide: ContratoActivoReader, useClass: SqlContratoActivoReader },
    { provide: PuntosInitializer, useClass: SqlPuntosInitializer },
    { provide: LoginHistoryReader, useClass: SqlLoginHistoryReader },
    { provide: BrandingReader, useClass: SqlBrandingReader },
  ],
  exports: [ColaboradorRepository],
})
export class ColaboradoresModule {}
