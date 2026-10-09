import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingOrmEntity } from '../../shared/infrastructure/persistence/orm/app-setting.orm-entity';
import { PdfRenderer } from './application/ports/pdf-renderer.port';
import { PdfTextExtractor } from './application/ports/pdf-text-extractor.port';
import {
  GenerarCertificadoIngresosUseCase,
  GenerarCertificadoLaboralUseCase,
  GetContratosCertificablesUseCase,
  ListCertificadosUseCase,
} from './application/use-cases/certificados.use-cases';
import {
  DeleteCuentaBancariaUseCase,
  ListCuentasBancariasUseCase,
  SaveCuentaBancariaUseCase,
} from './application/use-cases/cuentas-bancarias.use-cases';
import {
  DescargarDesprendiblePdfUseCase,
  GetDesprendibleUseCase,
  GetReportesResumenUseCase,
  ListDesprendiblesUseCase,
} from './application/use-cases/desprendibles.use-cases';
import {
  CancelarImportacionUseCase,
  CerrarLotesAtascadosUseCase,
  ConfirmarImportacionUseCase,
  GetLoteUseCase,
  HistorialImportacionesUseCase,
  ObtenerPreviewUseCase,
  PrevisualizarImportacionUseCase,
  ProcesarLoteUseCase,
} from './application/use-cases/importacion-nomina.use-cases';
import { NominaParser } from './domain/nomina-parser';
import {
  CedulasExistentesReader,
  CertificadoConfigReader,
  ContratoReader,
  NominaEmpleadoImporter,
  PerfilColaboradorReader,
} from './domain/ports';
import {
  CertificadoRepository,
  CuentaBancariaRepository,
  DesprendibleRepository,
  NominaImportLoteRepository,
  NominaPreviewStore,
} from './domain/repositories';
import { MiPuestoController } from './infrastructure/http/mi-puesto.controller';
import { NominaImportacionController } from './infrastructure/http/nomina-importacion.controller';
import { PdfkitPdfRenderer } from './infrastructure/pdf/pdfkit-pdf-renderer';
import { PopplerPdfTextExtractor } from './infrastructure/pdf/poppler-pdf-text-extractor';
import { CertificadoOrmEntity } from './infrastructure/persistence/certificado.orm-entity';
import { CuentaBancariaOrmEntity } from './infrastructure/persistence/cuenta-bancaria.orm-entity';
import { DesprendibleNominaOrmEntity } from './infrastructure/persistence/desprendible-nomina.orm-entity';
import { NominaImportErrorOrmEntity } from './infrastructure/persistence/nomina-import-error.orm-entity';
import { NominaImportLoteOrmEntity } from './infrastructure/persistence/nomina-import-lote.orm-entity';
import { NominaImportPreviewOrmEntity } from './infrastructure/persistence/nomina-import-preview.orm-entity';
import { TypeOrmNominaEmpleadoImporter } from './infrastructure/persistence/typeorm-nomina-empleado-importer';
import {
  AppSettingsCertificadoConfigReader,
  TypeOrmCedulasExistentesReader,
  TypeOrmContratoReader,
  TypeOrmPerfilColaboradorReader,
} from './infrastructure/persistence/typeorm-nomina.readers';
import {
  TypeOrmCertificadoRepository,
  TypeOrmCuentaBancariaRepository,
  TypeOrmDesprendibleRepository,
  TypeOrmNominaImportLoteRepository,
  TypeOrmNominaPreviewStore,
} from './infrastructure/persistence/typeorm-nomina.repositories';

/**
 * Contexto "Nómina y mi puesto de trabajo": cuentas bancarias, desprendibles,
 * certificados (laboral e ingresos/retenciones) e importación de nómina PDF.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CuentaBancariaOrmEntity,
      DesprendibleNominaOrmEntity,
      CertificadoOrmEntity,
      NominaImportLoteOrmEntity,
      NominaImportErrorOrmEntity,
      NominaImportPreviewOrmEntity,
      AppSettingOrmEntity,
    ]),
  ],
  controllers: [MiPuestoController, NominaImportacionController],
  providers: [
    // Casos de uso
    ListCuentasBancariasUseCase,
    SaveCuentaBancariaUseCase,
    DeleteCuentaBancariaUseCase,
    ListDesprendiblesUseCase,
    GetDesprendibleUseCase,
    DescargarDesprendiblePdfUseCase,
    GetReportesResumenUseCase,
    ListCertificadosUseCase,
    GetContratosCertificablesUseCase,
    GenerarCertificadoLaboralUseCase,
    GenerarCertificadoIngresosUseCase,
    CerrarLotesAtascadosUseCase,
    PrevisualizarImportacionUseCase,
    ObtenerPreviewUseCase,
    ConfirmarImportacionUseCase,
    CancelarImportacionUseCase,
    ProcesarLoteUseCase,
    GetLoteUseCase,
    HistorialImportacionesUseCase,
    // Servicio de dominio
    NominaParser,
    // Puertos → adaptadores
    { provide: CuentaBancariaRepository, useClass: TypeOrmCuentaBancariaRepository },
    { provide: DesprendibleRepository, useClass: TypeOrmDesprendibleRepository },
    { provide: CertificadoRepository, useClass: TypeOrmCertificadoRepository },
    { provide: NominaImportLoteRepository, useClass: TypeOrmNominaImportLoteRepository },
    { provide: NominaPreviewStore, useClass: TypeOrmNominaPreviewStore },
    { provide: PerfilColaboradorReader, useClass: TypeOrmPerfilColaboradorReader },
    { provide: ContratoReader, useClass: TypeOrmContratoReader },
    { provide: CertificadoConfigReader, useClass: AppSettingsCertificadoConfigReader },
    { provide: CedulasExistentesReader, useClass: TypeOrmCedulasExistentesReader },
    { provide: NominaEmpleadoImporter, useClass: TypeOrmNominaEmpleadoImporter },
    { provide: PdfRenderer, useClass: PdfkitPdfRenderer },
    { provide: PdfTextExtractor, useClass: PopplerPdfTextExtractor },
  ],
  exports: [DesprendibleRepository, CertificadoRepository],
})
export class NominaModule {}
