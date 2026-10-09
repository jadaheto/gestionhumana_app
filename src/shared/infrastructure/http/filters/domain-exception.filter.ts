import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidOperationError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../domain/domain-error';

/**
 * Traduce errores de dominio a respuestas HTTP con un cuerpo uniforme:
 * `{ statusCode, code, message }`.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.statusFor(exception);
    if (status >= 500) this.logger.error(exception.message, exception.stack);
    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }

  private statusFor(error: DomainError): number {
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
    if (error instanceof InvalidOperationError) return HttpStatus.UNPROCESSABLE_ENTITY;
    if (error instanceof ConflictError) return HttpStatus.CONFLICT;
    if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
