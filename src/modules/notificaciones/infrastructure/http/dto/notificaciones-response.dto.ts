import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificacionResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() titulo!: string;
  @ApiPropertyOptional({ nullable: true }) mensaje!: string | null;
  @ApiProperty() tipo!: string;
  @ApiProperty() leida!: boolean;
  @ApiPropertyOptional({ nullable: true }) link!: string | null;
  @ApiProperty() createdAt!: string;
}

export class ListaNotificacionesResponseDto {
  @ApiProperty() noLeidas!: number;
  @ApiProperty({ type: [NotificacionResponseDto] }) items!: NotificacionResponseDto[];
}

export class ContadorNoLeidasResponseDto {
  @ApiProperty() noLeidas!: number;
}

export class MarcadasResponseDto {
  @ApiProperty() marcadas!: number;
}
