import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Actor } from '../../../../shared/domain/actor';
import { TokenIssuer } from '../../application/token-issuer.port';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtTokenIssuer extends TokenIssuer {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(actor: Actor): Promise<string> {
    const payload: JwtPayload = {
      sub: actor.id,
      username: actor.username,
      role: actor.role,
      firstName: actor.firstName,
      lastName: actor.lastName,
      email: actor.email,
    };
    return this.jwt.signAsync(payload);
  }
}
