import { BrandingSlot, CertificadoLaboralConfig, CorreoComunicadosConfig } from '../../domain/configuracion';
import { IdentidadEmpresa } from '../../domain/identidad';

export type IdentidadDto = IdentidadEmpresa & { updatedAt: string | null };
export type SaveIdentidadInput = Partial<IdentidadEmpresa>;

export interface BrandingSlotDto {
  slot: BrandingSlot;
  label: string;
  /** Ruta relativa a `/uploads/` (null = usar el logo por defecto del frontend). */
  archivo: string | null;
  personalizado: boolean;
}

export type BrandingDto = Record<BrandingSlot, BrandingSlotDto>;

/** Archivo recibido por HTTP (multer en memoria). */
export interface ArchivoSubido {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export type SaveBrandingInput = Partial<Record<BrandingSlot, ArchivoSubido>>;

export type CorreoComunicadosDto = CorreoComunicadosConfig;
export type SaveCorreoComunicadosInput = { modo: string; testTo: string; prodTo: string };

export type CertificadoLaboralConfigDto = CertificadoLaboralConfig;
export interface SaveCertificadoLaboralConfigInput {
  jefeNombre: string;
  jefeCargo: string;
  firma: ArchivoSubido | null;
  /** Elimina la firma configurada (se ignora si llega una firma nueva). */
  quitarFirma?: boolean;
}
