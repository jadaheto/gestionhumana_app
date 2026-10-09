import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AsignarPuntosRequestDto {
  @ApiProperty({ description: 'Id del colaborador que recibe los puntos' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiProperty({ maxLength: 255, example: 'Excelente desempeño en proyecto X' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  concepto!: string;
}

export class ListCanjesQueryDto {
  @ApiPropertyOptional({ enum: ['pendiente', 'aprobado', 'rechazado', 'usado', 'todos'], default: 'pendiente' })
  @IsOptional()
  @IsIn(['pendiente', 'aprobado', 'rechazado', 'usado', 'todos'])
  estado?: 'pendiente' | 'aprobado' | 'rechazado' | 'usado' | 'todos';
}

export class HistorialQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Máximo de movimientos a devolver (por defecto, todos)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
