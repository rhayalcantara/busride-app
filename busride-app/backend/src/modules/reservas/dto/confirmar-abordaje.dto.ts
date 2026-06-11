import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

// El conductorId NO viaja en el body: se deriva del JWT (@CurrentUser) en el controller (F4).
export class ConfirmarAbordajeDto {
  @ApiProperty({ description: 'Token JWT del QR escaneado al pasajero' })
  @IsString()
  @IsNotEmpty({ message: 'El qrToken es obligatorio' })
  qrToken: string;

  @ApiProperty({ example: 7, minimum: 1, description: 'Número de asiento asignado al pasajero' })
  @IsInt({ message: 'El numeroAsiento debe ser un número entero' })
  @Min(1, { message: 'El numeroAsiento debe ser mayor o igual a 1' })
  numeroAsiento: number;
}
