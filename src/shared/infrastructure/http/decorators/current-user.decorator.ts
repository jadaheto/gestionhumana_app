import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../../../domain/actor';

/** Inyecta el `Actor` autenticado (construido por `JwtStrategy`). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ user: Actor }>();
  return request.user;
});
