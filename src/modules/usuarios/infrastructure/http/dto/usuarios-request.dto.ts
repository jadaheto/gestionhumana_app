import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_ROLES } from '../../../../../shared/domain/user-role';

export class UpdateUsuarioRequestDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @ApiProperty({ maxLength: 255 }) @IsEmail() @MaxLength(255) email!: string;
  @ApiProperty({ enum: USER_ROLES }) @IsIn([...USER_ROLES]) role!: string;
  @ApiPropertyOptional({ description: 'Administrador que además es empleado (sólo aplica al rol admin)' })
  @IsOptional()
  @IsBoolean()
  esColaborador?: boolean;
  @ApiPropertyOptional({ description: 'Designado para crear eventos para todos los trabajadores' })
  @IsOptional()
  @IsBoolean()
  puedeCrearEventos?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sedeId?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() areaId?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() cargoId?: number | null;
}

export class CreateUsuarioRequestDto extends UpdateUsuarioRequestDto {
  @ApiProperty({ maxLength: 100, description: 'Sin espacios' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^\S+$/, { message: 'El nombre de usuario no puede contener espacios.' })
  username!: string;

  @ApiPropertyOptional({ minLength: 8, description: 'Si se omite se genera una contraseña temporal' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string | null;
}

export class ResetPasswordUsuarioRequestDto {
  @ApiPropertyOptional({ minLength: 8, description: 'Si se omite se genera una contraseña temporal' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(100)
  newPassword?: string | null;
}
