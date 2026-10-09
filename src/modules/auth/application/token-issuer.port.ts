import { Actor } from '../../../shared/domain/actor';

/** Puerto para emitir tokens de acceso (implementado con JWT en infraestructura). */
export abstract class TokenIssuer {
  abstract issue(actor: Actor): Promise<string>;
}
