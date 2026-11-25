import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { TIPOS_INCAPACIDAD } from '../../../domain/incapacidad';
import { ESTADOS_PERMISO, TIPOS_PERMISO } from '../../../domain/permiso';

/** `YYYY-MM-DD` opcionalmente seguido de `THH:mm[:ss]` o ` HH:mm[:ss]`. */
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte cadenas vacías (típicas de multipart) en undefined para que apliquen los opcionales. */
const emptyToUndefined = () =>
  Transform(({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
    const original = obj?.[key];
    return original === '' || original === null || original === undefined ? undefined : value;
  });

export class CrearSolicitudRequestDto {
  @ApiProperty({ enum: TIPOS_PERMISO }) @IsIn(TIPOS_PERMISO) tipoPermiso!: string;
  @ApiProperty({ example: '2026-03-02T08:00', description: 'Fecha/hora de inicio' })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_HORA, { message: 'fechaInicio debe tener formato YYYY-MM-DD[THH:mm]' })
  fechaInicio!: string;
  @ApiProperty({ example: '2026-03-02T12:00', description: 'Fecha/hora de fin' })
  @IsString()
  @IsNotEmpty()
  @Matches(FECHA_HORA, { message: 'fechaFin debe tener formato YYYY-MM-DD[THH:mm]' })
  fechaFin!: string;
  @ApiPropertyOptional({ description: 'Horas (sólo permisos parciales)', example: 4 })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  horas?: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) justificacion!: string;
}

export class ResolverSolicitudRequestDto {
  @ApiPropertyOptional({ description: 'Observación de respuesta' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}

export class SuspenderVacacionesRequestDto {
  @ApiProperty({ minimum: 1, description: 'Días hábiles efectivamente disfrutados' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diasDisfrutados!: number;
  @ApiPropertyOptional({ description: 'Motivo de la suspensión' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivo?: string;
}

export class FiltroSolicitudesQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS_PERMISO })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(ESTADOS_PERMISO)
  estado?: string;
}

export class FiltroSolicitudesJefeQueryDto {
  @ApiPropertyOptional({ enum: ['pendiente', 'aprobado', 'rechazado'], description: 'Estado del visto bueno del jefe' })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['pendiente', 'aprobado', 'rechazado'])
  estado?: string;
}

export class RegistrarIncapacidadRequestDto {
  @ApiPropertyOptional({ description: 'Colaborador (sólo administradores)' })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
  @ApiProperty({ enum: TIPOS_INCAPACIDAD }) @IsIn(TIPOS_INCAPACIDAD) tipo!: string;
  @ApiProperty({ example: '2026-03-02' })
  @Matches(FECHA, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio!: string;
  @ApiProperty({ example: '2026-03-04' })
  @Matches(FECHA, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin!: string;
  @ApiPropertyOptional({ minimum: 1 })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dias?: number;
  @ApiPropertyOptional({ maxLength: 200 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  entidadEmisora?: string;
  @ApiPropertyOptional({ maxLength: 50 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroIncapacidad?: string;
}
