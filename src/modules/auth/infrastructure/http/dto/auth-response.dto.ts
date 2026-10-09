import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ['admin', 'funcionario'] }) role!: string;
  @ApiProperty({ nullable: true }) profileImage!: string | null;
  @ApiProperty({ type: Object }) uiPreferences!: Record<string, string>;
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ type: AuthenticatedUserResponseDto }) user!: AuthenticatedUserResponseDto;
}
