import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { AuthUserRepository } from '../../domain/auth-user.repository';
import { AuthenticatedUserDto } from '../dto/auth.dto';

@Injectable()
export class GetCurrentUserUseCase implements UseCase<Actor, AuthenticatedUserDto> {
  constructor(private readonly users: AuthUserRepository) {}

  async execute(actor: Actor): Promise<AuthenticatedUserDto> {
    const user = await this.users.findById(actor.id);
    if (!user) throw new NotFoundError('Usuario', actor.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage,
      uiPreferences: user.uiPreferences,
    };
  }
}
