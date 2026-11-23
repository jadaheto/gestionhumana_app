import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/domain/actor';

export const LIMITE_POR_MINUTO = 30;
const VENTANA_MS = 60_000;

/** Límite de frecuencia en memoria: 30 preguntas por minuto por usuario (cada llamada cuesta tokens). */
@Injectable()
export class LimiteFrecuenciaGuard implements CanActivate {
  private readonly marcas = new Map<number, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const actor = context.switchToHttp().getRequest<{ user?: Actor }>().user;
    if (!actor) return true;
    const ahora = Date.now();
    const recientes = (this.marcas.get(actor.id) ?? []).filter((t) => ahora - t < VENTANA_MS);
    if (recientes.length >= LIMITE_POR_MINUTO) {
      this.marcas.set(actor.id, recientes);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiadas preguntas seguidas. Espera un momento e intenta de nuevo.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recientes.push(ahora);
    this.marcas.set(actor.id, recientes);
    return true;
  }
}
