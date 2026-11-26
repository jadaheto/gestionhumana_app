import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TIPOS_AREA } from '../../../domain/area';

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
  @ApiPropertyOptional({ description: 'Área de la que depende en el organigrama (null = raíz)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  padreId?: number | null;
  @ApiPropertyOptional({ minimum: 0, description: 'Posición entre sus hermanas en el organigrama' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
  @ApiPropertyOptional({ enum: TIPOS_AREA, description: 'Lugar del área en el organigrama' })
  @IsOptional()
  @IsIn(TIPOS_AREA)
  tipo?: string;
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
