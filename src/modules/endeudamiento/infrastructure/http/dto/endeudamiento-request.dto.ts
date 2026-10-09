import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConceptoRequestDto {
  @ApiProperty({ example: 'SALUD', maxLength: 150 }) @IsString() @MaxLength(150) concepto!: string;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) devengado?: number;
  @ApiPropertyOptional({ example: 100000 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deducido?: number;
}

export class CrearSolicitudRequestDto {
  @ApiProperty({ description: 'Id del colaborador evaluado' }) @Type(() => Number) @IsInt() @Min(1) userId!: number;
  @ApiPropertyOptional({ example: 'SOL-2026-0001', description: 'Si se omite se genera automáticamente' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  solicitudNo?: string;
  @ApiProperty({ example: '2026-10-08' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100) libranza?: string;
  @ApiProperty({ example: 2500000 }) @Type(() => Number) @IsNumber() @Min(0) salarioMensual!: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otrosDevengados?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deduccionesLey?: number;
  @ApiPropertyOptional({ example: 50, description: 'Porcentaje máximo; si es 0 se usa 50' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  umbralAprobacion?: number;
  @ApiProperty({ type: [ConceptoRequestDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ConceptoRequestDto)
  conceptos!: ConceptoRequestDto[];
  @ApiPropertyOptional({ example: 12000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorSolicitado?: number;
  @ApiPropertyOptional({ example: 24 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) plazoMeses?: number;
  @ApiPropertyOptional({ example: 500000 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cuotaMensual?: number;
  @ApiPropertyOptional({ example: 'A', maxLength: 10 }) @IsOptional() @IsString() @MaxLength(10) opcionCredito?: string;
  @ApiPropertyOptional({ description: 'Conclusión manual; si se omite se calcula por umbral' })
  @IsOptional()
  @IsString()
  conclusion?: string;
}

export class BuscarColaboradorQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido, cédula o código de empresa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
