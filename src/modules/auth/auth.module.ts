import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/configuration';
import { UserOrmEntity } from '../../shared/infrastructure/persistence/orm/user.orm-entity';
import { GoogleIdentityProvider } from './application/google-identity.port';
import { TokenIssuer } from './application/token-issuer.port';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { GoogleLoginUseCase } from './application/use-cases/google-login.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { GetUiPreferencesUseCase, SaveUiPreferencesUseCase } from './application/use-cases/ui-preferences.use-cases';
import { ValidateResetTokenUseCase } from './application/use-cases/validate-reset-token.use-case';
import { ActiveContractChecker } from './domain/active-contract-checker.port';
import { AuthUserRepository } from './domain/auth-user.repository';
import { LoginHistoryRepository } from './domain/login-history.repository';
import { PasswordResetRepository } from './domain/password-reset.repository';
import { AuthController } from './infrastructure/http/auth.controller';
import { LoginHistoryOrmEntity } from './infrastructure/persistence/login-history.orm-entity';
import { PasswordResetOrmEntity } from './infrastructure/persistence/password-reset.orm-entity';
import { TypeOrmActiveContractChecker } from './infrastructure/persistence/typeorm-active-contract-checker';
import { TypeOrmAuthUserRepository } from './infrastructure/persistence/typeorm-auth-user.repository';
import { TypeOrmLoginHistoryRepository } from './infrastructure/persistence/typeorm-login-history.repository';
import { TypeOrmPasswordResetRepository } from './infrastructure/persistence/typeorm-password-reset.repository';
import { GoogleOAuthProvider } from './infrastructure/security/google-oauth.provider';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const jwt = config.get('jwt', { infer: true });
        return { secret: jwt.secret, signOptions: { expiresIn: jwt.expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` } };
      },
    }),
    TypeOrmModule.forFeature([UserOrmEntity, PasswordResetOrmEntity, LoginHistoryOrmEntity]),
  ],
  controllers: [AuthController],
  providers: [
    // Casos de uso
    LoginUseCase,
    GoogleLoginUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ValidateResetTokenUseCase,
    GetUiPreferencesUseCase,
    SaveUiPreferencesUseCase,
    GetCurrentUserUseCase,
    // Puertos → adaptadores
    { provide: AuthUserRepository, useClass: TypeOrmAuthUserRepository },
    { provide: PasswordResetRepository, useClass: TypeOrmPasswordResetRepository },
    { provide: LoginHistoryRepository, useClass: TypeOrmLoginHistoryRepository },
    { provide: ActiveContractChecker, useClass: TypeOrmActiveContractChecker },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
    { provide: GoogleIdentityProvider, useClass: GoogleOAuthProvider },
    JwtStrategy,
  ],
  exports: [LoginHistoryRepository],
})
export class AuthModule {}
