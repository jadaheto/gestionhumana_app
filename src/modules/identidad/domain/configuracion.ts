import { ValidationError } from '../../../shared/domain/domain-error';

/** Carpeta de uploads para logos y firmas (misma que el legado). */
export const CARPETA_BRANDING = 'branding';
/** Límite de 5 MB por archivo (legado: `max_size = 5120` KB). */
export const MAX_BYTES_BRANDING = 5120 * 1024;

// ---------- Branding (helpers/branding_helper.php) ----------
export const BRANDING_SLOTS = ['light', 'dark', 'sm', 'auth', 'favicon'] as const;
export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

export interface BrandingSlotDef {
  key: string;
  label: string;
  extensiones: string[];
}

export const BRANDING_SLOT_DEFS: Record<BrandingSlot, BrandingSlotDef> = {
  light: { key: 'branding_logo_light', label: 'Logo claro', extensiones: ['png', 'jpg', 'jpeg', 'svg'] },
  dark: { key: 'branding_logo_dark', label: 'Logo oscuro', extensiones: ['png', 'jpg', 'jpeg', 'svg'] },
  sm: { key: 'branding_logo_sm', label: 'Logo pequeño', extensiones: ['png', 'jpg', 'jpeg', 'svg'] },
  auth: { key: 'branding_logo_auth', label: 'Logo de inicio de sesión', extensiones: ['png', 'jpg', 'jpeg', 'svg'] },
  favicon: { key: 'branding_favicon', label: 'Favicon', extensiones: ['ico', 'png'] },
};

/** Normaliza rutas heredadas (`uploads/branding/x.png` → `branding/x.png`). */
export function normalizarRutaUpload(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().replace(/^\/+/, '');
  if (v === '') return null;
  return v.startsWith('uploads/') ? v.slice('uploads/'.length) : v;
}

// ---------- Correo de comunicados ----------
export const CLAVES_CORREO_COMUNICADOS = {
  modo: 'comunicados_mail_mode',
  testTo: 'comunicados_mail_test_to',
  prodTo: 'comunicados_mail_prod_to',
} as const;

export type ModoCorreo = 'test' | 'produccion';

export interface CorreoComunicadosConfig {
  modo: ModoCorreo;
  testTo: string;
  prodTo: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCorreoComunicados(input: {
  modo: string;
  testTo: string;
  prodTo: string;
}): CorreoComunicadosConfig {
  const testTo = input.testTo.trim();
  const prodTo = input.prodTo.trim();
  if (testTo === '' || !EMAIL_RE.test(testTo)) throw new ValidationError('Correo de pruebas inválido.');
  if (prodTo === '' || !EMAIL_RE.test(prodTo)) throw new ValidationError('Correo de producción inválido.');
  return { modo: input.modo === 'produccion' ? 'produccion' : 'test', testTo, prodTo };
}

// ---------- Certificado laboral ----------
export const CLAVES_CERTIFICADO_LABORAL = {
  jefeNombre: 'cert_jefe_nombre',
  jefeCargo: 'cert_jefe_cargo',
  firmaPng: 'cert_firma_png',
} as const;

export const CERTIFICADO_LABORAL_DEFAULTS = {
  jefeNombre: 'Jefe Departamento Gestión Humana',
  jefeCargo: 'Jefe Departamento Gestión Humana',
};

export interface CertificadoLaboralConfig {
  jefeNombre: string;
  jefeCargo: string;
  /** Ruta relativa a `/uploads/` de la firma PNG, o null. */
  firma: string | null;
}

export function validarFirmante(input: { jefeNombre: string; jefeCargo: string }): {
  jefeNombre: string;
  jefeCargo: string;
} {
  const jefeNombre = input.jefeNombre.trim();
  const jefeCargo = input.jefeCargo.trim();
  if (jefeNombre === '' || jefeCargo === '') throw new ValidationError('Debes indicar nombre y cargo del firmante.');
  return { jefeNombre, jefeCargo };
}
