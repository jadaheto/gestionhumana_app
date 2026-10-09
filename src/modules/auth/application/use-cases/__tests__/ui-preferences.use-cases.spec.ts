import { funcionarioActor } from '../../../../../shared/testing/fakes';
import { GetUiPreferencesUseCase, SaveUiPreferencesUseCase } from '../ui-preferences.use-cases';
import { buildUser, InMemoryAuthUserRepository } from './in-memory-auth.repositories';

describe('Preferencias de interfaz', () => {
  let users: InMemoryAuthUserRepository;

  beforeEach(() => {
    users = new InMemoryAuthUserRepository();
    users.users.push(buildUser());
  });

  it('devuelve las preferencias con los valores por defecto', async () => {
    const prefs = await new GetUiPreferencesUseCase(users).execute(funcionarioActor);
    expect(prefs).toEqual({ language: 'es', theme: 'light' });
  });

  it('solo persiste claves conocidas de tipo texto', async () => {
    const result = await new SaveUiPreferencesUseCase(users).execute({
      actor: funcionarioActor,
      preferences: { theme: 'dark', 'data-layout': 'vertical', hack: 'x', language: 42 },
    });
    expect(result).toEqual({ language: 'es', theme: 'dark', 'data-layout': 'vertical' });
    expect(users.prefsUpdates[0].prefs).not.toHaveProperty('hack');
  });
});
