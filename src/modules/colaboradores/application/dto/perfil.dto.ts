import { Actor } from '../../../../shared/domain/actor';
import { ExperienceItem, PerfilDatos, PerfilPortafolio, PerfilProps, PrivacySettings } from '../../domain/perfil';
import { LoginHistoryItem } from '../../domain/ports';

export interface PerfilDto extends PerfilProps {
  fullName: string;
  completionPct: number;
}

export interface PerfilCompletoDto extends PerfilDto {
  loginHistory: LoginHistoryItem[];
}

export interface UpdatePerfilInput {
  actor: Actor;
  datos: PerfilDatos;
}

export interface UpdatePortafolioInput {
  actor: Actor;
  portafolio: PerfilPortafolio;
}

export interface UploadPerfilImageInput {
  actor: Actor;
  kind: 'profile' | 'cover';
  content: Buffer;
  originalName: string;
  mimeType: string;
}

export interface ChangePasswordInput {
  actor: Actor;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdatePrivacySettingsInput {
  actor: Actor;
  settings: Partial<Record<string, unknown>>;
}

export interface UpdateExperienceInput {
  actor: Actor;
  experience: Array<Partial<ExperienceItem>>;
}

export type PrivacySettingsDto = PrivacySettings;
