import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{1,2}:\d{2}(:\d{2})?$/;

export class ResumenQueryDto {
  @ApiProperty({ description: 'Id de la sede' }) @Type(() => Number) @IsInt() @Min(1) sedeId!: number;
  @ApiPropertyOptional({ example: '2026-10-08', description: 'Fecha YYYY-MM-DD; por defecto hoy' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha?: string;
}

export class ImportarMarcacionesRequestDto {
  @ApiProperty({ description: 'Id de la sede a la que pertenece el archivo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId!: number;
}

export class EnviarMemorandosRequestDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) sedeId!: number;
  @ApiPropertyOptional({ example: '2026-10-08' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha?: string;
}

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === 1 || value === '1' || value === 'on';

export class SavePoliticaRequestDto {
  @ApiProperty({ example: '08:10', description: 'Hora límite de entrada (HH:mm)' })
  @IsString()
  @Matches(HORA, { message: 'horaEntradaLimite debe tener formato HH:mm' })
  horaEntradaLimite!: string;
  @ApiProperty({ example: '11:59', description: 'Hora de referencia de salida temprana (HH:mm)' })
  @IsString()
  @Matches(HORA, { message: 'horaSalidaTemprana debe tener formato HH:mm' })
  horaSalidaTemprana!: string;
  @ApiProperty({ minimum: 0, example: 0 }) @Type(() => Number) @IsInt() @Min(0) toleranciaMinutos!: number;
  @ApiProperty({ description: 'Enviar memorando por correo al detectar tardanza' })
  @Transform(toBoolean)
  @IsBoolean()
  enviarMemorandoTardanza!: boolean;
}

export class HistorialQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Por defecto, primer día del mes actual' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'desde debe tener formato YYYY-MM-DD' })
  desde?: string;
  @ApiPropertyOptional({ example: '2026-10-31', description: 'Por defecto, último día del mes actual' })
  @IsOptional()
  @IsString()
  @Matches(FECHA, { message: 'hasta debe tener formato YYYY-MM-DD' })
  hasta?: string;
}
