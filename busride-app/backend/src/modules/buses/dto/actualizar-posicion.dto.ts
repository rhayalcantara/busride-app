import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ActualizarPosicionDto {
  @ApiProperty({ example: 18.4861, description: 'Latitud actual del bus' })
  @IsLatitude({ message: 'La latitud no es válida' })
  lat: number;

  @ApiProperty({ example: -69.9312, description: 'Longitud actual del bus' })
  @IsLongitude({ message: 'La longitud no es válida' })
  lng: number;
}
