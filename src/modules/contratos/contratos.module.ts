import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingOrmEntity } from '../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { ContratoDocumentRenderer } from './application/contrato-document-renderer.port';
import {
  EliminarContratoUseCase,
  GuardarContratoUseCase,
  ListarColaboradoresUseCase,
  ListarContratosUseCase,
  ListarProrrogasUseCase,
  ObtenerContratoUseCase,
  RegistrarProrrogaUseCase,
} from './application/use-cases/contratos.use-cases';
import { GenerarDocumentoContratoUseCase } from './application/use-cases/generar-documento-contrato.use-case';
import { NotificarContratosPorVencerUseCase } from './application/use-cases/notificar-contratos-por-vencer.use-case';
import { SincronizarContratosVencidosUseCase } from './application/use-cases/sincronizar-contratos-vencidos.use-case';
import { BrandingPort, NotificacionesPort, UsuariosPort } from './domain/ports';
import { ContratoAlertaRepository, ContratoProrrogaRepository, ContratoRepository } from './domain/repositories';
import { ContratosController } from './infrastructure/http/contratos.controller';
import { PdfKitContratoDocumentRenderer } from './infrastructure/pdf/pdfkit-contrato-document-renderer';
import { ContratoAlertaOrmEntity } from './infrastructure/persistence/contrato-alerta.orm-entity';
import { ContratoProrrogaOrmEntity } from './infrastructure/persistence/contrato-prorroga.orm-entity';
import { ContratoOrmEntity } from './infrastructure/persistence/contrato.orm-entity';
import { TypeOrmBrandingAdapter } from './infrastructure/persistence/typeorm-branding.adapter';
import { TypeOrmContratoAlertaRepository } from './infrastructure/persistence/typeorm-contrato-alerta.repository';
import { TypeOrmContratoProrrogaRepository } from './infrastructure/persistence/typeorm-contrato-prorroga.repository';
import { TypeOrmContratoRepository } from './infrastructure/persistence/typeorm-contrato.repository';
import { TypeOrmNotificacionesAdapter } from './infrastructure/persistence/typeorm-notificaciones.adapter';
import { TypeOrmUsuariosAdapter } from './infrastructure/persistence/typeorm-usuarios.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContratoOrmEntity,
      ContratoProrrogaOrmEntity,
      ContratoAlertaOrmEntity,
      AppSettingOrmEntity,
    ]),
  ],
  controllers: [ContratosController],
  providers: [
    // Casos de uso
    ListarContratosUseCase,
    ObtenerContratoUseCase,
    GuardarContratoUseCase,
    EliminarContratoUseCase,
    RegistrarProrrogaUseCase,
    ListarProrrogasUseCase,
    ListarColaboradoresUseCase,
    GenerarDocumentoContratoUseCase,
    SincronizarContratosVencidosUseCase,
    NotificarContratosPorVencerUseCase,
    // Puertos → adaptadores
    { provide: ContratoRepository, useClass: TypeOrmContratoRepository },
    { provide: ContratoProrrogaRepository, useClass: TypeOrmContratoProrrogaRepository },
    { provide: ContratoAlertaRepository, useClass: TypeOrmContratoAlertaRepository },
    { provide: UsuariosPort, useClass: TypeOrmUsuariosAdapter },
    { provide: NotificacionesPort, useClass: TypeOrmNotificacionesAdapter },
    { provide: BrandingPort, useClass: TypeOrmBrandingAdapter },
    { provide: ContratoDocumentRenderer, useClass: PdfKitContratoDocumentRenderer },
  ],
  exports: [ContratoRepository, SincronizarContratosVencidosUseCase],
})
export class ContratosModule {}
