import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ESTADOS_TAREA, PRIORIDADES_TAREA } from '../../../domain/tarea';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;

// ---------- Tareas ----------
export class GuardarTareaRequestDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @IsNotEmpty() @MaxLength(255) titulo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string | null;
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255) proyecto?: string | null;
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255) cliente?: string | null;
  @ApiPropertyOptional({ maxLength: 255, description: 'Responsable (texto libre del legado)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  responsable?: string | null;
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(FECHA, { message: 'fechaLimite debe ser YYYY-MM-DD' })
  fechaLimite?: string | null;
  @ApiPropertyOptional({ enum: ESTADOS_TAREA }) @IsOptional() @IsIn([...ESTADOS_TAREA]) estado?: string;
  @ApiPropertyOptional({ enum: PRIORIDADES_TAREA }) @IsOptional() @IsIn([...PRIORIDADES_TAREA]) prioridad?: string;
  @ApiPropertyOptional({ type: [Number], description: 'Ids de usuarios asignados' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  asignadoIds?: number[];
}

export class CambiarEstadoTareaRequestDto {
  @ApiProperty({ enum: ESTADOS_TAREA }) @IsIn([...ESTADOS_TAREA]) estado!: string;
}

// ---------- Calendario ----------
export class GuardarEventoRequestDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @IsNotEmpty() @MaxLength(255) titulo!: string;
  @ApiProperty({ example: '2026-10-15T09:00', description: 'YYYY-MM-DD o YYYY-MM-DDTHH:mm' })
  @Matches(FECHA_HORA, { message: 'inicio debe ser YYYY-MM-DD o YYYY-MM-DDTHH:mm' })
  inicio!: string;
  @ApiPropertyOptional({ example: '2026-10-15T10:00' })
  @IsOptional()
  @Matches(FECHA_HORA, { message: 'fin debe ser YYYY-MM-DD o YYYY-MM-DDTHH:mm' })
  fin?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() todoElDia?: boolean;
  @ApiPropertyOptional({ maxLength: 50, example: 'bg-primary-subtle' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  clase?: string | null;
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255) ubicacion?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string | null;
  @ApiPropertyOptional({ description: 'Evento para todos los trabajadores (sólo Gestión Humana o designados)' })
  @IsOptional()
  @IsBoolean()
  paraTodos?: boolean;
}

// ---------- Chat ----------
export class EnviarMensajeRequestDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) receptorId!: number;
  @ApiProperty({ maxLength: 5000 }) @IsString() @IsNotEmpty() @MaxLength(5000) mensaje!: string;
}

// ---------- Correo ----------
export class RedactarCorreoRequestDto {
  @ApiProperty({ example: 'destinatario@comfasucre.com.co' })
  @IsEmail({}, { message: 'El correo del destinatario no es válido.' })
  paraEmail!: string;
  @ApiProperty({ maxLength: 255 }) @IsString() @IsNotEmpty() @MaxLength(255) asunto!: string;
  @ApiProperty() @IsString() @IsNotEmpty() cuerpo!: string;
}

// ---------- API keys ----------
export class ApiKeyNombreRequestDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @IsNotEmpty() @MaxLength(255) nombre!: string;
}

export class EliminarApiKeysRequestDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
