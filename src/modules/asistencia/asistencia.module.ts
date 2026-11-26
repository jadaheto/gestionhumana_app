import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaFileParser } from './application/ports/asistencia-file-parser.port';
import { ConsolidarResumenDiarioUseCase } from './application/use-cases/consolidar-resumen-diario.use-case';
import { EnviarMemorandosUseCase } from './application/use-cases/enviar-memorandos.use-case';
import { GetMiHistorialUseCase } from './application/use-cases/get-mi-historial.use-case';
import { GetResumenDiarioUseCase } from './application/use-cases/get-resumen-diario.use-case';
import { ImportarMarcacionesUseCase } from './application/use-cases/importar-marcaciones.use-case';
import { SincronizarMarcacionesExternasUseCase } from './application/use-cases/sincronizar-marcaciones-externas.use-case';
import { ListSedesAsistenciaUseCase } from './application/use-cases/list-sedes.use-case';
import { GetPoliticaUseCase, SavePoliticaUseCase } from './application/use-cases/politica.use-cases';
import {
  AsistenciaMarcacionRepository,
  AsistenciaPoliticaRepository,
  AsistenciaRegistroRepository,
  AsistenciaResumenRepository,
  ColaboradoresSedeReader,
  JustificacionReader,
  MarcacionesExternasReader,
  SedesReader,
} from './domain/ports';
import { PgMarcacionesExternasReader } from './infrastructure/persistence/pg-marcaciones-externas.reader';
import { AsistenciaController } from './infrastructure/http/asistencia.controller';
import { BufferAsistenciaFileParser } from './infrastructure/parsers/asistencia-file.parser';
import {
  AsistenciaImportacionOrmEntity,
  AsistenciaMarcacionOrmEntity,
  AsistenciaOrmEntity,
  AsistenciaPoliticaOrmEntity,
  AsistenciaResumenDiarioOrmEntity,
} from './infrastructure/persistence/asistencia.orm-entities';
import {
  TypeOrmColaboradoresSedeReader,
  TypeOrmJustificacionReader,
  TypeOrmSedesReader,
} from './infrastructure/persistence/typeorm-asistencia.readers';
import {
  TypeOrmAsistenciaMarcacionRepository,
  TypeOrmAsistenciaPoliticaRepository,
  TypeOrmAsistenciaRegistroRepository,
  TypeOrmAsistenciaResumenRepository,
} from './infrastructure/persistence/typeorm-asistencia.repositories';

/** Bounded context de asistencia (reloj biométrico, políticas, memorandos e historial). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsistenciaOrmEntity,
      AsistenciaImportacionOrmEntity,
      AsistenciaMarcacionOrmEntity,
      AsistenciaPoliticaOrmEntity,
      AsistenciaResumenDiarioOrmEntity,
    ]),
  ],
  controllers: [AsistenciaController],
  providers: [
    ConsolidarResumenDiarioUseCase,
    GetResumenDiarioUseCase,
    ImportarMarcacionesUseCase,
    SincronizarMarcacionesExternasUseCase,
    EnviarMemorandosUseCase,
    GetPoliticaUseCase,
    SavePoliticaUseCase,
    ListSedesAsistenciaUseCase,
    GetMiHistorialUseCase,
    { provide: AsistenciaPoliticaRepository, useClass: TypeOrmAsistenciaPoliticaRepository },
    { provide: AsistenciaMarcacionRepository, useClass: TypeOrmAsistenciaMarcacionRepository },
    { provide: AsistenciaResumenRepository, useClass: TypeOrmAsistenciaResumenRepository },
    { provide: AsistenciaRegistroRepository, useClass: TypeOrmAsistenciaRegistroRepository },
    { provide: ColaboradoresSedeReader, useClass: TypeOrmColaboradoresSedeReader },
    { provide: JustificacionReader, useClass: TypeOrmJustificacionReader },
    { provide: SedesReader, useClass: TypeOrmSedesReader },
    { provide: AsistenciaFileParser, useClass: BufferAsistenciaFileParser },
    { provide: MarcacionesExternasReader, useClass: PgMarcacionesExternasReader },
  ],
})
export class AsistenciaModule {}
