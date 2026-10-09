import { Body, Controller, Get, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator';
import {
  ArchivoSubido,
  BrandingDto,
  CertificadoLaboralConfigDto,
  CorreoComunicadosDto,
  SaveBrandingInput,
} from '../../application/dto/identidad.dto';
import {
  GetBrandingUseCase,
  GetCertificadoLaboralConfigUseCase,
  GetCorreoComunicadosUseCase,
  SaveBrandingUseCase,
  SaveCertificadoLaboralConfigUseCase,
  SaveCorreoComunicadosUseCase,
} from '../../application/use-cases/configuracion.use-cases';
import { BRANDING_SLOTS } from '../../domain/configuracion';
import {
  SaveBrandingRequestDto,
  SaveCertificadoLaboralRequestDto,
  SaveCorreoComunicadosRequestDto,
} from './dto/identidad-request.dto';

const toArchivo = (f: Express.Multer.File): ArchivoSubido => ({
  buffer: f.buffer,
  originalName: f.originalname,
  mimeType: f.mimetype,
  size: f.size,
});

type ArchivosBranding = Partial<Record<(typeof BRANDING_SLOTS)[number], Express.Multer.File[]>>;

/** Configuración de la aplicación (`app_settings`): branding, correo de comunicados y certificado laboral. */
@ApiTags('Configuración')
@Controller()
export class ConfiguracionController {
  constructor(
    private readonly getBranding: GetBrandingUseCase,
    private readonly saveBranding: SaveBrandingUseCase,
    private readonly getCorreo: GetCorreoComunicadosUseCase,
    private readonly saveCorreo: SaveCorreoComunicadosUseCase,
    private readonly getCertificado: GetCertificadoLaboralConfigUseCase,
    private readonly saveCertificado: SaveCertificadoLaboralConfigUseCase,
  ) {}

  // ---------- Branding ----------
  @Public()
  @Get('config/branding')
  @ApiOperation({ summary: 'Logos y favicon (público: lo usa la pantalla de inicio de sesión)' })
  branding(): Promise<BrandingDto> {
    return this.getBranding.execute();
  }

  @Put('admin/config/branding')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir logos (png/jpg/jpeg/svg) y favicon (ico/png); sólo los slots enviados' })
  @UseInterceptors(FileFieldsInterceptor(BRANDING_SLOTS.map((name) => ({ name, maxCount: 1 }))))
  guardarBranding(
    @UploadedFiles() files: ArchivosBranding | undefined,

    @Body() _dto: SaveBrandingRequestDto,
  ): Promise<BrandingDto> {
    const input: SaveBrandingInput = {};
    for (const slot of BRANDING_SLOTS) {
      const f = files?.[slot]?.[0];
      if (f) input[slot] = toArchivo(f);
    }
    return this.saveBranding.execute(input);
  }

  // ---------- Correo de comunicados ----------
  @Get('admin/config/correo-comunicados')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configuración del correo de comunicados (modo, correo de pruebas y de producción)' })
  correo(): Promise<CorreoComunicadosDto> {
    return this.getCorreo.execute();
  }

  @Put('admin/config/correo-comunicados')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar configuración del correo de comunicados' })
  guardarCorreo(@Body() dto: SaveCorreoComunicadosRequestDto): Promise<CorreoComunicadosDto> {
    return this.saveCorreo.execute(dto);
  }

  // ---------- Certificado laboral ----------
  @Get('admin/config/certificado-laboral')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configuración del certificado laboral (firmante, cargo y firma PNG)' })
  certificado(): Promise<CertificadoLaboralConfigDto> {
    return this.getCertificado.execute();
  }

  @Put('admin/config/certificado-laboral')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Guardar firmante y cargo; firma PNG opcional' })
  @UseInterceptors(FileInterceptor('firma'))
  guardarCertificado(
    @Body() dto: SaveCertificadoLaboralRequestDto,
    @UploadedFile() firma: Express.Multer.File | undefined,
  ): Promise<CertificadoLaboralConfigDto> {
    return this.saveCertificado.execute({
      jefeNombre: dto.jefeNombre,
      jefeCargo: dto.jefeCargo,
      firma: firma ? toArchivo(firma) : null,
    });
  }
}
