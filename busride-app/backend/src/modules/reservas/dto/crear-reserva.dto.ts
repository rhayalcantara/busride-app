import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsLatitude, IsLongitude, IsUUID } from 'class-validator';

// El pasajeroId NO viaja en el body: se deriva del JWT (@CurrentUser) en el controller (F4).
export class CrearReservaDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'ID del viaje a reservar' })
  @IsUUID('4', { message: 'El viajeId debe ser un UUID válido' })
  viajeId: string;

  @ApiProperty({ example: 12, description: 'ID de la parada de origen' })
  @IsInt({ message: 'La paradaOrigenId debe ser un número entero' })
  paradaOrigenId: number;

  @ApiProperty({ example: 18, description: 'ID de la parada de destino' })
  @IsInt({ message: 'La paradaDestinoId debe ser un número entero' })
  paradaDestinoId: number;

  @ApiProperty({ example: 18.4861, description: 'Latitud actual del pasajero' })
  @IsLatitude({ message: 'La latPasajero debe ser una latitud válida (-90 a 90)' })
  latPasajero: number;

  @ApiProperty({ example: -69.9312, description: 'Longitud actual del pasajero' })
  @IsLongitude({ message: 'La lngPasajero debe ser una longitud válida (-180 a 180)' })
  lngPasajero: number;
}
