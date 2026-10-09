import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty() userId!: number;
  @ApiProperty() puntosActuales!: number;
  @ApiProperty() puntosTotalesGanados!: number;
  @ApiProperty() puntosTotalesCanjeados!: number;
  @ApiPropertyOptional({ nullable: true }) updatedAt!: string | null;
}

export class TransaccionResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() userId!: number;
  @ApiProperty({ enum: ['ganado', 'canjeado', 'reintegro'] }) tipo!: string;
  @ApiProperty() cantidad!: number;
  @ApiProperty() concepto!: string;
  @ApiPropertyOptional({ nullable: true }) referenciaId!: number | null;
  @ApiProperty() createdAt!: string;
}

export class RecompensaResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional({ nullable: true }) descripcion!: string | null;
  @ApiProperty() puntosRequeridos!: number;
  @ApiProperty() tipo!: string;
  @ApiProperty() icono!: string;
  @ApiProperty() estado!: string;
}

export class CanjeResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() userId!: number;
  @ApiProperty() colaboradorNombre!: string;
  @ApiProperty() recompensaId!: number;
  @ApiProperty() recompensaNombre!: string;
  @ApiProperty() puntosUsados!: number;
  @ApiProperty({ enum: ['pendiente', 'aprobado', 'rechazado', 'usado'] }) estado!: string;
  @ApiPropertyOptional({ nullable: true }) aprobadoPor!: number | null;
  @ApiPropertyOptional({ nullable: true }) aprobadoPorNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) fechaUso!: string | null;
  @ApiProperty() createdAt!: string;
}

export class ColaboradorResumenResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional({ nullable: true }) cedula!: string | null;
  @ApiPropertyOptional({ nullable: true }) cargoNombre!: string | null;
}
