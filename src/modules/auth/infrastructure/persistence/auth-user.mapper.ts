import { isUserRole } from '../../../../shared/domain/user-role';
import { UserOrmEntity } from '../../../../shared/infrastructure/persistence/orm/user.orm-entity';
import { AuthUser, UiPreferences } from '../../domain/auth-user';

export class AuthUserMapper {
  static toDomain(row: UserOrmEntity): AuthUser {
    return AuthUser.create({
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      role: isUserRole(row.role) ? row.role : 'funcionario',
      estadoColaborador: row.estado_colaborador ?? 'activo',
      profileImage: row.profile_image,
      uiPreferences: normalizePrefs(row.ui_preferences),
    });
  }
}

function normalizePrefs(raw: unknown): UiPreferences {
  if (!raw || typeof raw !== 'object') return {};
  const out: UiPreferences = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
