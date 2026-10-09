import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Cuerpo multipart para crear/editar un comunicado (los archivos van en `archivos`). */
export class SaveComunicadoRequestDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) titulo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumen?: string;
  @ApiProperty() @IsString() @IsNotEmpty() contenido!: string;
  @ApiPropertyOptional({ enum: ['borrador', 'publicado'], description: 'Sólo al crear' })
  @IsOptional()
  @IsIn(['borrador', 'publicado'])
  estado?: 'borrador' | 'publicado';
  @ApiPropertyOptional({ description: 'URLs de vídeo externo, una por línea' })
  @IsOptional()
  @IsString()
  videoUrls?: string;
  @ApiPropertyOptional({ description: 'Ids de medios a eliminar (sólo al editar), separados por coma', example: '3,7' })
  @IsOptional()
  @IsString()
  eliminarMedios?: string;
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Imágenes, vídeos (mp4/webm/ogg) o PDF',
  })
  archivos?: unknown;
}

export class FeedQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 9, maximum: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  size?: number;
}

/** Convierte "3,7, 9" en [3, 7, 9]. */
export function parseIds(raw: string | undefined): number[] {
  return (raw ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}
