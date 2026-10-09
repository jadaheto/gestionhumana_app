import { Body, Controller, Get, HttpCode, Ip, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Actor } from '../../../../shared/domain/actor';
import { CurrentUser } from '../../../../shared/infrastructure/http/decorators/current-user.decorator';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator';
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
  ) {}

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
}
