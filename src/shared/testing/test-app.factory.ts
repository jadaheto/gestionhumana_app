import { CanActivate, ExecutionContext, INestApplication, ModuleMetadata, Type, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Actor } from '../domain/actor';
import { DomainExceptionFilter } from '../infrastructure/http/filters/domain-exception.filter';
import { RolesGuard } from '../infrastructure/http/guards/roles.guard';

/**
 * Guard de pruebas: inyecta un `Actor` fijo en `request.user`, emulando el JWT.
 * Si `actor` es null, simula una petición anónima.
 */
export function fakeAuthGuard(actor: Actor | null): Type<CanActivate> {
  class FakeAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      if (!actor) return false;
      context.switchToHttp().getRequest<{ user: Actor }>().user = actor;
      return true;
    }
  }
  return FakeAuthGuard;
}

export interface TestAppOptions {
  controllers: ModuleMetadata['controllers'];
  providers: ModuleMetadata['providers'];
  actor: Actor | null;
}

/**
 * Crea una aplicación Nest mínima para probar un controlador con sus casos de
 * uso sustituidos por dobles. Aplica el mismo ValidationPipe y filtro de
 * errores que la aplicación real.
 */
export async function createTestApp(options: TestAppOptions): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: options.controllers,
    providers: [
      ...(options.providers ?? []),
      { provide: APP_GUARD, useClass: fakeAuthGuard(options.actor) },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.init();
  return app;
}
