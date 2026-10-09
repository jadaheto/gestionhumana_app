import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const TIPOS_CONTRATO_DTO = ['indefinido', 'fijo', 'prestacion_servicios', 'obra_labor', 'aprendizaje'];
export const ESTADOS_CONTRATO_DTO = ['activo', 'finalizado', 'renovado'];

export class GuardarContratoRequestDto {
  @ApiProperty({ description: 'Id del colaborador (users.id). En edición se ignora.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty({ enum: TIPOS_CONTRATO_DTO }) @IsIn(TIPOS_CONTRATO_DTO) tipoContrato!: string;

  @ApiProperty({ maxLength: 50 }) @IsString() @IsNotEmpty() @MaxLength(50) numeroContrato!: string;

  @ApiProperty({ example: '2026-01-01', description: 'AAAA-MM-DD' })
  @IsString()
  @Matches(FECHA_ISO, { message: 'fechaInicio debe tener formato AAAA-MM-DD' })
  fechaInicio!: string;

  @ApiPropertyOptional({ example: '2026-12-31', nullable: true, description: 'AAAA-MM-DD; vacío = indefinido' })
  @Transform(({ value }) => (value === '' ? null : (value as unknown)))
  @IsOptional()
  @IsString()
  @Matches(FECHA_ISO, { message: 'fechaFin debe tener formato AAAA-MM-DD' })
  fechaFin?: string | null;

  @ApiProperty({ example: 2500000 }) @Type(() => Number) @IsNumber() @Min(0.01) salarioBase!: number;

  @ApiPropertyOptional({ enum: ESTADOS_CONTRATO_DTO, default: 'activo' })
  @IsOptional()
  @IsIn(ESTADOS_CONTRATO_DTO)
  estado?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() observaciones?: string | null;
}

export class RegistrarProrrogaRequestDto {
  @ApiProperty({ minimum: 1, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Debes indicar una cantidad de meses válida para la prórroga.' })
  meses!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) observacion?: string;
}

/** Campos del asistente (paso 1 + paso 2). Llega como multipart/form-data junto a `firmaPng`. */
export class GenerarDocumentoRequestDto {
  @ApiProperty({ enum: ['preaviso', 'prorroga', 'renovacion'] })
  @IsIn(['preaviso', 'prorroga', 'renovacion'])
  tipo!: string;
  @ApiPropertyOptional({ description: 'Meses de prórroga (por defecto 3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  meses?: number;
  @ApiPropertyOptional({ description: 'Número de prórroga (por defecto 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero?: number;
  @ApiPropertyOptional({ description: 'Años de renovación (por defecto 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anios?: number;
  @ApiPropertyOptional({ description: 'Código del documento (G.H.3.1. / D.A.3)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;
  @ApiPropertyOptional({ default: 'DIRECTORA ADMINISTRATIVA' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  firmanteNombre?: string;
  @ApiPropertyOptional({ default: 'Comfasucre' }) @IsOptional() @IsString() @MaxLength(150) firmanteCargo?: string;
  @ApiPropertyOptional({ default: 'Jefe Departamento' }) @IsOptional() @IsString() @MaxLength(150) revisoUno?: string;
  @ApiPropertyOptional({ default: 'Revisó Jurídica' }) @IsOptional() @IsString() @MaxLength(150) revisoDos?: string;
  @ApiPropertyOptional({ default: 'Talento Humano' }) @IsOptional() @IsString() @MaxLength(150) proyecto?: string;
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Firma/sello PNG (máx. 5 MB)' })
  firmaPng?: unknown;
}
