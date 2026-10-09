import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Actor } from '../../../domain/actor';
import { ForbiddenError } from '../../../domain/domain-error';
import { UserRole } from '../../../domain/user-role';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: Actor }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenError();
    }
    return true;
  }
}
