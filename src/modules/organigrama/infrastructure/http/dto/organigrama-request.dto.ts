import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DirectorioQueryDto {
  @ApiPropertyOptional({ description: 'Nombre, correo o cargo' }) @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) areaId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) sedeId?: number;
}

export class ImportarCargosRequestDto {
  @ApiProperty({
    description:
      'Texto pegado con columnas CARGO y AREA (tabulado) y opcionalmente CARGO, SALARIO 2024, AUMENTO 2025, AREA',
    example: 'CARGO\tAREA\nAnalista de Nómina\tGestión Humana',
  })
  @IsString()
  @IsNotEmpty({ message: 'Debes pegar un dataset con columnas CARGO y AREA (y opcionalmente salarios).' })
  dataset!: string;
}
