import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Convierte '' en undefined para que los campos opcionales no fallen la validación. */
const emptyToUndefined = () =>
  Transform(({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
    const raw = obj?.[key];
    return raw === '' || raw === null || value === '' || value === null ? undefined : value;
  });

export class SaveColaboradorRequestDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) firstName!: string;
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) lastName!: string;
  @ApiProperty({ maxLength: 255 }) @IsEmail() @MaxLength(255) email!: string;
  @ApiProperty({ maxLength: 20 }) @IsString() @IsNotEmpty() @MaxLength(20) cedula!: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoEmpresa?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;
  @ApiPropertyOptional({ maxLength: 20 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(20) celular?: string;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @Type(() => Number) @IsInt() sedeId?: number;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @Type(() => Number) @IsInt() areaId?: number;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @Type(() => Number) @IsInt() cargoId?: number;
  @ApiPropertyOptional({ enum: ['activo', 'inactivo', 'retirado'], default: 'activo' })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'retirado'])
  estadoColaborador?: string;
  @ApiPropertyOptional({ example: '1990-05-20' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  fechaNacimiento?: string;
  @ApiPropertyOptional({ example: '2024-01-15' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  fechaIngreso?: string;
  @ApiPropertyOptional({ enum: ['masculino', 'femenino', 'otro'] })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['masculino', 'femenino', 'otro'])
  genero?: string;
  @ApiPropertyOptional({ enum: ['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'] })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'])
  estadoCivil?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(100) eps?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(100) arl?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fondoPension?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cajaCompensacion?: string;
  @ApiPropertyOptional({ enum: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
  tipoSangre?: string;
  @ApiPropertyOptional({ maxLength: 100, description: 'Cargo/designación libre' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;
}

export class CreateColaboradorRequestDto extends SaveColaboradorRequestDto {
  @ApiPropertyOptional({
    description: 'Si se omite se genera a partir del nombre (inicial + apellido).',
    maxLength: 100,
  })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'El usuario sólo admite letras, números, punto, guion y guion bajo.' })
  username?: string;
  @ApiPropertyOptional({
    description: 'Si se omite se genera una contraseña temporal que se devuelve una sola vez.',
    minLength: 8,
  })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class ListColaboradoresQueryDto {
  @ApiPropertyOptional({ enum: ['activo', 'inactivo', 'retirado'] })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'retirado'])
  estado?: string;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @Type(() => Number) @IsInt() @Min(1) areaId?: number;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @Type(() => Number) @IsInt() @Min(1) sedeId?: number;
}

/** Convierte el DTO validado en la entrada del caso de uso (opcionales → null). */
export function toSaveColaboradorInput(dto: SaveColaboradorRequestDto) {
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    cedula: dto.cedula,
    codigoEmpresa: dto.codigoEmpresa ?? null,
    phoneNumber: dto.phoneNumber ?? null,
    telefono: dto.telefono ?? null,
    celular: dto.celular ?? null,
    sedeId: dto.sedeId ?? null,
    areaId: dto.areaId ?? null,
    cargoId: dto.cargoId ?? null,
    estadoColaborador: dto.estadoColaborador ?? 'activo',
    fechaNacimiento: dto.fechaNacimiento ?? null,
    fechaIngreso: dto.fechaIngreso ?? null,
    genero: dto.genero ?? null,
    estadoCivil: dto.estadoCivil ?? null,
    direccion: dto.direccion ?? null,
    eps: dto.eps ?? null,
    arl: dto.arl ?? null,
    fondoPension: dto.fondoPension ?? null,
    cajaCompensacion: dto.cajaCompensacion ?? null,
    tipoSangre: dto.tipoSangre ?? null,
    designation: dto.designation ?? null,
  };
}
