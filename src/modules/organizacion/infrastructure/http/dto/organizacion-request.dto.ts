import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveSedeRequestDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150) nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) direccion?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) ciudad?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @ApiPropertyOptional({ enum: ['activo', 'inactivo'] }) @IsOptional() @IsIn(['activo', 'inactivo']) estado?: string;
}

export class SaveAreaRequestDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150) nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sedeId?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() responsableId?: number | null;
  @ApiPropertyOptional({ enum: ['activo', 'inactivo'] }) @IsOptional() @IsIn(['activo', 'inactivo']) estado?: string;
}

export class SaveCargoRequestDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150) nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() areaId?: number | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: '1=Director … 5=Auxiliar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  nivelJerarquico?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() funciones?: string | null;
  @ApiPropertyOptional({ enum: ['activo', 'inactivo'] }) @IsOptional() @IsIn(['activo', 'inactivo']) estado?: string;
}
