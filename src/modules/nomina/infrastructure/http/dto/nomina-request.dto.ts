import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveCuentaBancariaRequestDto {
  @ApiProperty({ maxLength: 100, example: 'Bancolombia' }) @IsString() @IsNotEmpty() @MaxLength(100) banco!: string;
  @ApiProperty({ enum: ['ahorros', 'corriente'] }) @IsIn(['ahorros', 'corriente']) tipoCuenta!: string;
  @ApiProperty({ maxLength: 30 }) @IsString() @IsNotEmpty() @MaxLength(30) numeroCuenta!: string;
  @ApiPropertyOptional({ description: 'Colaborador dueño de la cuenta (por defecto, el propio administrador)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class CuentasQueryDto {
  @ApiPropertyOptional({ description: 'Colaborador a consultar (sólo administradores)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class GenerarCertificadoLaboralRequestDto {
  @ApiProperty({
    enum: ['actual', 'historico', 'vencido'],
    description: 'actual = contrato vigente; historico = vigente + vencidos; vencido = un contrato vencido',
  })
  @IsIn(['actual', 'historico', 'vencido'])
  modo!: 'actual' | 'historico' | 'vencido';

  @ApiPropertyOptional({ description: 'Obligatorio cuando modo = vencido' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contratoId?: number | null;

  @ApiPropertyOptional({ default: false, description: 'Incluir las funciones del cargo (certificado con funciones)' })
  @IsOptional()
  @IsBoolean()
  incluirFunciones?: boolean;
}

export class GenerarCertificadoIngresosRequestDto {
  @ApiProperty({ example: 2025, description: 'Año gravable' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;
}

export class PreviewImportacionRequestDto {
  @ApiPropertyOptional({
    enum: ['auto', 'COLEGIO', 'CAMPANOS', 'COMFASUCRE'],
    description: 'Fuente de nómina; auto = detectar desde el PDF',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9 _-]*$/, { message: 'La fuente contiene caracteres no permitidos.' })
  fuente?: string;
}

export class ProcesarLoteRequestDto {
  @ApiPropertyOptional({ description: 'Posición inicial; si se omite continúa donde quedó' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 50, description: 'Empleados por tanda' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number;
}
