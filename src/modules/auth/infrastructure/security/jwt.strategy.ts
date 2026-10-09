import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../../config/configuration';
import { Actor } from '../../../../shared/domain/actor';
import { UnauthorizedError } from '../../../../shared/domain/domain-error';
import { isUserRole } from '../../../../shared/domain/user-role';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  validate(payload: JwtPayload): Actor {
    if (!isUserRole(payload.role)) throw new UnauthorizedError();
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    };
  }
}
