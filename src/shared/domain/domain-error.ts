/**
 * Errores de dominio. Son independientes del transporte (HTTP) y se traducen
 * a códigos de estado en `DomainExceptionFilter` (capa de infraestructura).
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** El recurso solicitado no existe. → HTTP 404 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(entity: string, id?: string | number) {
    super(id === undefined ? `${entity} no encontrado.` : `${entity} con id ${id} no encontrado.`);
  }
}

/** Datos de entrada inválidos según reglas de negocio. → HTTP 400 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

/** La operación viola una regla de negocio (estado inválido). → HTTP 422 */
export class InvalidOperationError extends DomainError {
  readonly code = 'INVALID_OPERATION';
  constructor(message: string) {
    super(message);
  }
}

/** El recurso ya existe o colisiona con uno existente. → HTTP 409 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  constructor(message: string) {
    super(message);
  }
}

/** El actor no tiene permisos para la operación. → HTTP 403 */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  constructor(message = 'Acceso denegado.') {
    super(message);
  }
}

/** Credenciales inválidas o sesión no válida. → HTTP 401 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  constructor(message = 'No autorizado.') {
    super(message);
  }
}
