import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token opaco recibido en login o en el último refresh' })
  @IsString()
  @IsNotEmpty({ message: 'El refreshToken es obligatorio' })
  refreshToken: string;
}
