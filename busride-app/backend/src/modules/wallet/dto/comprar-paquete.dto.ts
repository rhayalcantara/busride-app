import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class ComprarPaqueteDto {
  @ApiProperty({ example: 1, description: 'ID del paquete de viajes (tabla paquetes_viaje)' })
  @IsInt({ message: 'El paqueteId debe ser un número entero' })
  @Min(1, { message: 'El paqueteId debe ser mayor o igual a 1' })
  paqueteId: number;

  @ApiProperty({
    example: 'PAY-2026-0001-ABC',
    maxLength: 200,
    description: 'Referencia única de la pasarela de pago externa (clave de idempotencia)',
  })
  @IsString()
  @IsNotEmpty({ message: 'La referenciaExterna es obligatoria' })
  @MaxLength(200, { message: 'La referenciaExterna no puede exceder 200 caracteres' })
  referenciaExterna: string;
}
