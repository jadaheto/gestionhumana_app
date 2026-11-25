import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../config/configuration';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/domain-error';
import { AppSettingsRepository } from '../../domain/app-settings.repository';
import {
  BRANDING_SLOT_DEFS,
  BRANDING_SLOTS,
  CARPETA_BRANDING,
  CERTIFICADO_LABORAL_DEFAULTS,
  CLAVES_CERTIFICADO_LABORAL,
  CLAVES_CORREO_COMUNICADOS,
  MAX_BYTES_BRANDING,
  normalizarRutaUpload,
  validarCorreoComunicados,
  validarFirmante,
} from '../../domain/configuracion';
import {
  ArchivoSubido,
  BrandingDto,
  CertificadoLaboralConfigDto,
  CorreoComunicadosDto,
  SaveBrandingInput,
  SaveCertificadoLaboralConfigInput,
  SaveCorreoComunicadosInput,
} from '../dto/identidad.dto';

async function guardarEnBranding(storage: FileStorage, archivo: ArchivoSubido, extensiones: string[]): Promise<string> {
  const stored = await storage.save(archivo.buffer, {
    folder: CARPETA_BRANDING,
    originalName: archivo.originalName,
    mimeType: archivo.mimeType,
    allowedExtensions: extensiones,
    maxBytes: MAX_BYTES_BRANDING,
  });
  return stored.relativePath;
}

// ---------- Branding ----------

@Injectable()
export class GetBrandingUseCase implements UseCase<void, BrandingDto> {
  constructor(private readonly settings: AppSettingsRepository) {}

  async execute(): Promise<BrandingDto> {
    const values = await this.settings.getMany(BRANDING_SLOTS.map((s) => BRANDING_SLOT_DEFS[s].key));
    const dto = {} as BrandingDto;
    for (const slot of BRANDING_SLOTS) {
      const def = BRANDING_SLOT_DEFS[slot];
      const archivo = normalizarRutaUpload(values[def.key]);
      dto[slot] = { slot, label: def.label, archivo, personalizado: archivo !== null };
    }
    return dto;
  }
}

/** Sube los logos enviados (png/jpg/jpeg/svg; favicon ico/png) y actualiza `app_settings`. */
@Injectable()
export class SaveBrandingUseCase implements UseCase<SaveBrandingInput, BrandingDto> {
  constructor(
    private readonly settings: AppSettingsRepository,
    private readonly storage: FileStorage,
    private readonly getBranding: GetBrandingUseCase,
  ) {}

  async execute(input: SaveBrandingInput): Promise<BrandingDto> {
    const presentes = BRANDING_SLOTS.filter((s) => input[s]);
    if (presentes.length === 0) throw new ValidationError('No se seleccionaron archivos para actualizar logos.');
    for (const slot of presentes) {
      const def = BRANDING_SLOT_DEFS[slot];
      const path = await guardarEnBranding(this.storage, input[slot] as ArchivoSubido, def.extensiones);
      await this.settings.set(def.key, path);
    }
    return this.getBranding.execute();
  }
}

// ---------- Correo de comunicados ----------

@Injectable()
export class GetCorreoComunicadosUseCase implements UseCase<void, CorreoComunicadosDto> {
  constructor(
    private readonly settings: AppSettingsRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(): Promise<CorreoComunicadosDto> {
    const defaults = this.config.get('comunicados', { infer: true });
    const modo = await this.settings.get(CLAVES_CORREO_COMUNICADOS.modo, defaults.mailMode);
    return {
      modo: modo === 'produccion' ? 'produccion' : 'test',
      testTo: await this.settings.get(CLAVES_CORREO_COMUNICADOS.testTo, defaults.testTo),
      prodTo: await this.settings.get(CLAVES_CORREO_COMUNICADOS.prodTo, defaults.prodTo),
    };
  }
}

@Injectable()
export class SaveCorreoComunicadosUseCase implements UseCase<SaveCorreoComunicadosInput, CorreoComunicadosDto> {
  constructor(private readonly settings: AppSettingsRepository) {}

  async execute(input: SaveCorreoComunicadosInput): Promise<CorreoComunicadosDto> {
    const cfg = validarCorreoComunicados(input);
    await this.settings.set(CLAVES_CORREO_COMUNICADOS.modo, cfg.modo);
    await this.settings.set(CLAVES_CORREO_COMUNICADOS.testTo, cfg.testTo);
    await this.settings.set(CLAVES_CORREO_COMUNICADOS.prodTo, cfg.prodTo);
    return cfg;
  }
}

// ---------- Certificado laboral ----------

@Injectable()
export class GetCertificadoLaboralConfigUseCase implements UseCase<void, CertificadoLaboralConfigDto> {
  constructor(private readonly settings: AppSettingsRepository) {}

  async execute(): Promise<CertificadoLaboralConfigDto> {
    return {
      jefeNombre: await this.settings.get(
        CLAVES_CERTIFICADO_LABORAL.jefeNombre,
        CERTIFICADO_LABORAL_DEFAULTS.jefeNombre,
      ),
      jefeCargo: await this.settings.get(CLAVES_CERTIFICADO_LABORAL.jefeCargo, CERTIFICADO_LABORAL_DEFAULTS.jefeCargo),
      firma: normalizarRutaUpload(await this.settings.get(CLAVES_CERTIFICADO_LABORAL.firmaPng, '')),
    };
  }
}

/**
 * Guarda firmante y cargo. La firma (PNG o JPG) es opcional: si no se envía se
 * conserva la actual, salvo que se pida quitarla.
 */
@Injectable()
export class SaveCertificadoLaboralConfigUseCase implements UseCase<
  SaveCertificadoLaboralConfigInput,
  CertificadoLaboralConfigDto
> {
  constructor(
    private readonly settings: AppSettingsRepository,
    private readonly storage: FileStorage,
    private readonly getConfig: GetCertificadoLaboralConfigUseCase,
  ) {}

  async execute(input: SaveCertificadoLaboralConfigInput): Promise<CertificadoLaboralConfigDto> {
    const { jefeNombre, jefeCargo } = validarFirmante(input);
    if (input.firma) {
      const path = await guardarEnBranding(this.storage, input.firma, ['png', 'jpg', 'jpeg']);
      await this.settings.set(CLAVES_CERTIFICADO_LABORAL.firmaPng, path);
    } else if (input.quitarFirma) {
      await this.settings.set(CLAVES_CERTIFICADO_LABORAL.firmaPng, '');
    }
    await this.settings.set(CLAVES_CERTIFICADO_LABORAL.jefeNombre, jefeNombre);
    await this.settings.set(CLAVES_CERTIFICADO_LABORAL.jefeCargo, jefeCargo);
    return this.getConfig.execute();
  }
}
