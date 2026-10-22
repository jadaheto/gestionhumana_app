import { Body, Controller, Get, HttpCode, Ip, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../../config/configuration';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { DomainError } from '../../../../shared/domain/domain-error';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator';
import { GoogleIdentityProvider } from '../../application/google-identity.port';
import { GoogleLoginUseCase } from '../../application/use-cases/google-login.use-case';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import {
  GetUiPreferencesUseCase,
  SaveUiPreferencesUseCase,
} from '../../application/use-cases/ui-preferences.use-cases';
import { ValidateResetTokenUseCase } from '../../application/use-cases/validate-reset-token.use-case';
import {
  ForgotPasswordRequestDto,
  LoginRequestDto,
  ResetPasswordRequestDto,
  UiPreferencesRequestDto,
} from './dto/auth-request.dto';
import { AuthenticatedUserResponseDto, LoginResponseDto } from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly requestReset: RequestPasswordResetUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
    private readonly validateToken: ValidateResetTokenUseCase,
    private readonly getPrefs: GetUiPreferencesUseCase,
    private readonly savePrefs: SaveUiPreferencesUseCase,
    private readonly me: GetCurrentUserUseCase,
    private readonly googleLogin: GoogleLoginUseCase,
    private readonly google: GoogleIdentityProvider,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Get('google/estado')
  @ApiOperation({ summary: '¿Está habilitado el ingreso con Google?' })
  googleStatus(): { habilitado: boolean } {
    return { habilitado: this.google.isEnabled() };
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirige a Google para iniciar sesión (solo correos registrados)' })
  async googleStart(@Res() res: Response, @Query('returnUrl') returnUrl?: string): Promise<void> {
    try {
      res.redirect(await this.google.authorizationUrl(returnUrl));
    } catch (e) {
      this.redirectWithError(res, e instanceof DomainError ? e.message : 'No fue posible iniciar sesión con Google.');
    }
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Retorno de Google: valida la cuenta contra Usuarios y entrega la sesión al frontend' })
  async googleCallback(
    @Res() res: Response,
    @Req() req: Request,
    @Ip() ip: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<void> {
    if (error || !code || !state) {
      return this.redirectWithError(
        res,
        error === 'access_denied'
          ? 'Cancelaste el ingreso con Google.'
          : 'Google no devolvió un código de ingreso válido.',
      );
    }
    try {
      const { returnUrl } = await this.google.readState(state);
      const profile = await this.google.profileFromCode(code);
      const session = await this.googleLogin.execute({
        profile,
        device: (req.headers['user-agent'] ?? 'Desconocido').toString().slice(0, 255),
        ipAddress: ip,
      });
      const q = new URLSearchParams({ token: session.accessToken, returnUrl });
      res.redirect(`${this.config.get('frontendUrl', { infer: true })}/auth/google?${q.toString()}`);
    } catch (e) {
      this.redirectWithError(res, e instanceof DomainError ? e.message : 'No fue posible iniciar sesión con Google.');
    }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión con usuario/correo y contraseña' })
  @ApiOkResponse({ type: LoginResponseDto })
  signIn(@Body() dto: LoginRequestDto, @Req() req: Request, @Ip() ip: string): Promise<LoginResponseDto> {
    return this.login.execute({
      identifier: dto.identifier,
      password: dto.password,
      device: (req.headers['user-agent'] ?? 'Desconocido').toString().slice(0, 255),
      ipAddress: ip,
    });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar enlace de restablecimiento de contraseña por correo' })
  async forgot(@Body() dto: ForgotPasswordRequestDto): Promise<{ message: string }> {
    await this.requestReset.execute({ email: dto.email });
    return { message: 'Se envió un enlace de restablecimiento a tu correo electrónico.' };
  }

  @Public()
  @Get('reset-password/:token')
  @ApiOperation({ summary: 'Validar un token de restablecimiento' })
  validate(@Param('token') token: string): Promise<{ valid: boolean }> {
    return this.validateToken.execute(token);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer la contraseña con un token válido' })
  async reset(@Body() dto: ResetPasswordRequestDto): Promise<{ message: string }> {
    await this.resetPassword.execute(dto);
    return { message: 'Tu contraseña fue restablecida correctamente. Ya puedes iniciar sesión.' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado' })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  current(@CurrentUser() actor: Actor): Promise<AuthenticatedUserResponseDto> {
    return this.me.execute(actor);
  }

  @Get('ui-preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preferencias de interfaz del usuario' })
  getUiPreferences(@CurrentUser() actor: Actor): Promise<Record<string, string>> {
    return this.getPrefs.execute(actor);
  }

  @Put('ui-preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar preferencias de interfaz (tema, idioma, layout)' })
  saveUiPreferences(
    @CurrentUser() actor: Actor,
    @Body() dto: UiPreferencesRequestDto,
  ): Promise<Record<string, string>> {
    return this.savePrefs.execute({ actor, preferences: dto.preferences });
  }

  private redirectWithError(res: Response, message: string): void {
    res.redirect(`${this.config.get('frontendUrl', { infer: true })}/auth/login?error=${encodeURIComponent(message)}`);
  }
}
