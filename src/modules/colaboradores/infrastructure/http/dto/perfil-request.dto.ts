import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const emptyToUndefined = () =>
  Transform(({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
    const raw = obj?.[key];
    return raw === '' || raw === null || value === '' || value === null ? undefined : value;
  });

export class UpdatePerfilRequestDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @ApiProperty({ maxLength: 255 }) @IsEmail() @MaxLength(255) email!: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
  @ApiPropertyOptional({ maxLength: 20 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(20) zipCode?: string;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String], description: 'Habilidades (se guardan separadas por coma).' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  skills?: string[];
  @ApiPropertyOptional({ example: '2024-01-15' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  joiningDate?: string;
}

export class UpdatePortafolioRequestDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  githubUsername?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
  @ApiPropertyOptional({ maxLength: 100, description: 'Perfil de Facebook (columna heredada dribbble_username)' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dribbbleUsername?: string;
  @ApiPropertyOptional({ maxLength: 100, description: 'Usuario de Instagram (columna heredada pinterest_username)' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pinterestUsername?: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() oldPassword!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword!: string;
  @ApiProperty() @IsString() @IsNotEmpty() confirmPassword!: string;
}

export class PrivacySettingsRequestDto {
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() direct_messages?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() desktop_notifications?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() email_notifications?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() chat_notifications?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() comunicados_notifications?: boolean;
}

export class ExperienceItemRequestDto {
  @ApiProperty() @IsString() @MaxLength(200) job_title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) company_name?: string;
  @ApiPropertyOptional({ example: '2020' }) @IsOptional() @IsString() @MaxLength(10) year_from?: string;
  @ApiPropertyOptional({ example: 'Present' }) @IsOptional() @IsString() @MaxLength(10) year_to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateExperienceRequestDto {
  @ApiProperty({ type: [ExperienceItemRequestDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExperienceItemRequestDto)
  experience!: ExperienceItemRequestDto[];
}
