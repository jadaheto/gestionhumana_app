import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsObject, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ description: 'Usuario o correo electrónico', example: 'admin' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'persona@comfasucre.com.co' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() token!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) confirmPassword!: string;
}

export class UiPreferencesRequestDto {
  @ApiPropertyOptional({ type: Object, example: { language: 'es', theme: 'dark' } })
  @IsObject()
  preferences!: Record<string, unknown>;
}
