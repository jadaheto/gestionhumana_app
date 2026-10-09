import { ValidationError } from '../../../shared/domain/domain-error';
import { normalizeDate, normalizeText } from './colaborador';

/** Claves de `users.privacy_settings` (JSONB), como en `Profile::update_privacy_settings`. */
export const PRIVACY_KEYS = [
  'direct_messages',
  'desktop_notifications',
  'email_notifications',
  'chat_notifications',
  'comunicados_notifications',
] as const;
export type PrivacyKey = (typeof PRIVACY_KEYS)[number];
export type PrivacySettings = Record<PrivacyKey, boolean>;

/** Elemento de `users.experience` (JSONB), como en `Profile::update_experience`. */
export interface ExperienceItem {
  job_title: string;
  company_name: string;
  year_from: string;
  year_to: string;
  description: string;
}

export interface PerfilProps {
  id: number;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  designation: string | null;
  description: string | null;
  profileImage: string | null;
  coverImage: string | null;
  city: string | null;
  country: string | null;
  zipCode: string | null;
  website: string | null;
  skills: string[];
  joiningDate: string | null;
  githubUsername: string | null;
  dribbbleUsername: string | null;
  pinterestUsername: string | null;
  privacySettings: PrivacySettings;
  experience: ExperienceItem[];
}

/** Campos editables desde "Datos personales" (`Profile::update_personal_details`). */
export interface PerfilDatos {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  designation: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  zipCode: string | null;
  description: string | null;
  skills: string[];
  joiningDate: string | null;
}

/** Enlaces del portafolio (`Profile::update_portfolio`). */
export interface PerfilPortafolio {
  githubUsername: string | null;
  website: string | null;
  dribbbleUsername: string | null;
  pinterestUsername: string | null;
}

/** Campos usados por el legado para calcular el avance del perfil. */
export const CAMPOS_AVANCE: Array<keyof PerfilProps> = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'designation',
  'city',
  'country',
  'profileImage',
  'description',
  'skills',
  'website',
];

export function defaultPrivacySettings(): PrivacySettings {
  return {
    direct_messages: false,
    desktop_notifications: false,
    email_notifications: false,
    chat_notifications: false,
    comunicados_notifications: false,
  };
}

export function normalizePrivacySettings(input: Partial<Record<string, unknown>>): PrivacySettings {
  const result = defaultPrivacySettings();
  for (const key of PRIVACY_KEYS) result[key] = input[key] === true;
  return result;
}

/** Igual que el legado: descarta filas sin cargo y rellena vacíos con ''. */
export function normalizeExperience(items: Array<Partial<ExperienceItem>>): ExperienceItem[] {
  return items
    .filter((i) => (i.job_title ?? '').trim() !== '')
    .map((i) => ({
      job_title: (i.job_title ?? '').trim(),
      company_name: (i.company_name ?? '').trim(),
      year_from: String(i.year_from ?? '').trim(),
      year_to: String(i.year_to ?? '').trim(),
      description: (i.description ?? '').trim(),
    }));
}

export function parseSkills(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePerfilDatos(p: PerfilDatos): PerfilDatos {
  const firstName = (p.firstName ?? '').trim();
  const lastName = (p.lastName ?? '').trim();
  const email = (p.email ?? '').trim();
  if (firstName === '') throw new ValidationError('Los nombres son obligatorios.');
  if (lastName === '') throw new ValidationError('Los apellidos son obligatorios.');
  if (email === '' || !EMAIL_RE.test(email)) throw new ValidationError('El correo electrónico no es válido.');
  return {
    firstName,
    lastName,
    email,
    phoneNumber: normalizeText(p.phoneNumber),
    designation: normalizeText(p.designation),
    website: normalizeText(p.website),
    city: normalizeText(p.city),
    country: normalizeText(p.country),
    zipCode: normalizeText(p.zipCode),
    description: normalizeText(p.description),
    skills: (p.skills ?? []).map((s) => s.trim()).filter((s) => s !== ''),
    joiningDate: normalizeDate(p.joiningDate, 'La fecha de ingreso'),
  };
}

export class Perfil {
  private constructor(readonly props: PerfilProps) {}

  static create(props: PerfilProps): Perfil {
    return new Perfil({ ...props, privacySettings: { ...defaultPrivacySettings(), ...props.privacySettings } });
  }

  get id() {
    return this.props.id;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim() || this.props.username;
  }

  /** Porcentaje de campos completados, idéntico al cálculo de `views/profile/settings.php`. */
  get completionPct(): number {
    const filled = CAMPOS_AVANCE.filter((f) => {
      const v = this.props[f];
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined;
    }).length;
    return Math.round((filled / CAMPOS_AVANCE.length) * 100);
  }
}

/** Reglas de `Profile::change_password`. */
export function validateNewPassword(newPassword: string, confirmPassword: string): void {
  if (newPassword !== confirmPassword) throw new ValidationError('Las nuevas contraseñas no coinciden.');
  if ((newPassword ?? '').length < 8)
    throw new ValidationError('La nueva contraseña debe tener al menos 8 caracteres.');
}

export abstract class PerfilRepository {
  abstract findById(userId: number): Promise<Perfil | null>;
  abstract findPasswordHash(userId: number): Promise<string | null>;
  abstract updateDatos(userId: number, datos: PerfilDatos): Promise<void>;
  abstract updatePortafolio(userId: number, portafolio: PerfilPortafolio): Promise<void>;
  abstract updateImage(userId: number, kind: 'profile' | 'cover', relativePath: string): Promise<void>;
  abstract updatePassword(userId: number, hash: string): Promise<void>;
  abstract updatePrivacySettings(userId: number, settings: PrivacySettings): Promise<void>;
  abstract updateExperience(userId: number, experience: ExperienceItem[]): Promise<void>;
}
