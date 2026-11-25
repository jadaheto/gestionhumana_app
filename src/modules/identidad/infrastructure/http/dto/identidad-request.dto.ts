import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Todos los campos son opcionales: sólo se actualizan los enviados. */
export class SaveIdentidadRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() mision?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vision?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valores?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() principios?: string;
  @ApiPropertyOptional({ description: 'URL embebible del himno (p. ej. https://www.youtube.com/embed/...)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  himno_url?: string;
}

export class SaveCorreoComunicadosRequestDto {
  @ApiProperty({ enum: ['test', 'produccion'] }) @IsIn(['test', 'produccion']) modo!: 'test' | 'produccion';
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) testTo!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) prodTo!: string;
}

/** Multipart: `jefeNombre`, `jefeCargo` y archivo opcional `firma` (PNG). */
export class SaveCertificadoLaboralRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) jefeNombre!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) jefeCargo!: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) firma?: unknown;
}

/** Multipart con un archivo opcional por slot. */
export class SaveBrandingRequestDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) light?: unknown;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) dark?: unknown;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) sm?: unknown;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) auth?: unknown;
  @ApiPropertyOptional({ type: 'string', format: 'binary' }) favicon?: unknown;
}
