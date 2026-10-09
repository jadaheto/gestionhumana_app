import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const emptyToUndefined = () =>
  Transform(({ value, obj, key }: { value: unknown; obj: Record<string, unknown>; key: string }) => {
    const raw = obj?.[key];
    return raw === '' || raw === null || value === '' || value === null ? undefined : value;
  });
/** Para multipart: 'true'/'1'/'on' → true. */
const toBoolean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? ['true', '1', 'on'].includes(value.toLowerCase()) : value === true,
  );

export class UserIdQueryDto {
  @ApiPropertyOptional({ description: 'Sólo administradores: consultar a otro usuario.' })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class UpdateDatosBasicosRequestDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;
  @ApiPropertyOptional({ maxLength: 20 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(20) celular?: string;
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
  @ApiPropertyOptional({ enum: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
  tipoSangre?: string;
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
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numeroHijos?: number;
}

export class EducacionFormalRequestDto {
  @ApiProperty({
    enum: ['bachiller', 'tecnico', 'tecnologo', 'profesional', 'especializacion', 'maestria', 'doctorado'],
  })
  @IsIn(['bachiller', 'tecnico', 'tecnologo', 'profesional', 'especializacion', 'maestria', 'doctorado'])
  nivel!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) institucion!: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tituloObtenido?: string;
  @ApiPropertyOptional({ example: '2015-01-01' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  fechaInicio?: string;
  @ApiPropertyOptional({ example: '2019-12-01' }) @emptyToUndefined() @IsOptional() @Matches(DATE_RE) fechaFin?: string;
  @ApiPropertyOptional({ enum: ['finalizado', 'cursando', 'abandonado'], default: 'finalizado' })
  @emptyToUndefined()
  @IsOptional()
  @IsIn(['finalizado', 'cursando', 'abandonado'])
  estadoEstudio?: string;
  @ApiPropertyOptional({ maxLength: 50 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tarjetaProfesional?: string;
}

/** Se envía como multipart/form-data (campo `certificado` opcional con el archivo). */
export class EducacionNoFormalRequestDto {
  @ApiProperty({ enum: ['curso', 'diplomado', 'seminario', 'taller', 'certificacion', 'congreso'] })
  @IsIn(['curso', 'diplomado', 'seminario', 'taller', 'certificacion', 'congreso'])
  tipo!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) nombrePrograma!: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institucion?: string;
  @ApiPropertyOptional({ minimum: 0 })
  @emptyToUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  horas?: number;
  @ApiPropertyOptional({ example: '2024-03-10' }) @emptyToUndefined() @IsOptional() @Matches(DATE_RE) fecha?: string;
}

export class FamiliarRequestDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) nombreCompleto!: string;
  @ApiProperty({ enum: ['padre', 'madre', 'conyuge', 'hijo', 'hermano', 'otro'] })
  @IsIn(['padre', 'madre', 'conyuge', 'hijo', 'hermano', 'otro'])
  parentesco!: string;
  @ApiPropertyOptional({ example: '2010-08-01' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  fechaNacimiento?: string;
  @ApiPropertyOptional({ maxLength: 20 }) @emptyToUndefined() @IsOptional() @IsString() @MaxLength(20) cedula?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ocupacion?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @toBoolean() @IsBoolean() dependiente?: boolean;
}

export class ExperienciaLaboralRequestDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) empresa!: string;
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150) cargo!: string;
  @ApiPropertyOptional({ example: '2020-01-01' })
  @emptyToUndefined()
  @IsOptional()
  @Matches(DATE_RE)
  fechaInicio?: string;
  @ApiPropertyOptional({ example: '2022-06-30' }) @emptyToUndefined() @IsOptional() @Matches(DATE_RE) fechaFin?: string;
  @ApiPropertyOptional() @emptyToUndefined() @IsOptional() @IsString() funciones?: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivoRetiro?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefonoContacto?: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jefeInmediato?: string;
}
