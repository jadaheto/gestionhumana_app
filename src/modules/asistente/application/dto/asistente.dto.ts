import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EjecucionHerramienta, RespuestaAsistente } from '../../domain/respuesta';

export class TurnoHistorialDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  content!: string;
}

export class PreguntarDto {
  @ApiProperty({ maxLength: 4000, example: '¿Qué contratos vencen en los próximos 30 días?' })
  @IsString()
  @IsNotEmpty({ message: 'Escribe una pregunta (máximo 4000 caracteres).' })
  @MaxLength(4000, { message: 'Escribe una pregunta (máximo 4000 caracteres).' })
  pregunta!: string;

  @ApiPropertyOptional({ type: [TurnoHistorialDto], description: 'Turnos previos (se usan los últimos 12)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TurnoHistorialDto)
  historial?: TurnoHistorialDto[];

  @ApiPropertyOptional({ maxLength: 64, description: 'Clave de conversación generada por el cliente (solo auditoría)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversacion?: string;
}

export class EstadoAsistenteDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty() configurado!: boolean;
  @ApiProperty({ example: 'deepseek-chat' }) modelo!: string;
}

export class EjecucionHerramientaDto implements EjecucionHerramienta {
  @ApiProperty() herramienta!: string;
  @ApiProperty({ type: Object }) argumentos!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: Number }) filas!: number | null;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
  @ApiProperty() ms!: number;
}

export class UsoTokensDto {
  @ApiProperty() promptTokens!: number;
  @ApiProperty() completionTokens!: number;
}

export class RespuestaAsistenteDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ description: 'Respuesta en Markdown' }) respuesta!: string;
  @ApiProperty({ type: [EjecucionHerramientaDto] }) herramientas!: EjecucionHerramientaDto[];
  @ApiProperty({ type: UsoTokensDto }) uso!: UsoTokensDto;

  static from(r: RespuestaAsistente): RespuestaAsistenteDto {
    return { ok: true, respuesta: r.respuesta, herramientas: r.herramientas, uso: r.uso };
  }
}
