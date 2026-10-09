import { Actor } from '../../../../shared/domain/actor';
import { UiPreferences } from '../../domain/auth-user';

export interface LoginInput {
  identifier: string;
  password: string;
  device: string;
  ipAddress: string;
}

export interface AuthenticatedUserDto {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profileImage: string | null;
  uiPreferences: UiPreferences;
}

export interface LoginOutput {
  accessToken: string;
  user: AuthenticatedUserDto;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SaveUiPreferencesInput {
  actor: Actor;
  preferences: Record<string, unknown>;
}
