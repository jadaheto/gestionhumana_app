import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { UiPreferences } from '../../domain/auth-user';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { SaveUiPreferencesInput } from '../dto/auth.dto';

/** Claves de layout que se persisten (heredadas de la plantilla Velzon). */
export const UI_PREFERENCE_KEYS = [
  'language',
  'theme',
  'data-layout',
  'data-sidebar-size',
  'data-bs-theme',
  'data-sidebar-visibility',
  'data-layout-width',
  'data-layout-position',
  'data-topbar',
  'data-layout-style',
  'data-sidebar',
  'data-sidebar-image',
  'data-preloader',
] as const;

@Injectable()
export class GetUiPreferencesUseCase implements UseCase<Actor, UiPreferences> {
  constructor(private readonly users: AuthUserRepository) {}

  async execute(actor: Actor): Promise<UiPreferences> {
    const user = await this.users.findById(actor.id);
    if (!user) throw new NotFoundError('Usuario', actor.id);
    return user.uiPreferences;
  }
}

@Injectable()
export class SaveUiPreferencesUseCase implements UseCase<SaveUiPreferencesInput, UiPreferences> {
  constructor(private readonly users: AuthUserRepository) {}

  async execute(input: SaveUiPreferencesInput): Promise<UiPreferences> {
    const user = await this.users.findById(input.actor.id);
    if (!user) throw new NotFoundError('Usuario', input.actor.id);
    const merged = user.uiPreferences;
    for (const key of UI_PREFERENCE_KEYS) {
      const value = input.preferences[key];
      if (typeof value === 'string') merged[key] = value;
    }
    await this.users.updateUiPreferences(user.id, merged);
    return merged;
  }
}
