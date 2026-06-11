import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearBusDto {
  @ApiProperty({ description: 'ID de la asociación dueña del bus', format: 'uuid' })
  @IsUUID('4', { message: 'El asociacionId debe ser un UUID válido' })
  asociacionId: string;

  @ApiProperty({ example: 'ABC-1234', maxLength: 20, description: 'Placa única del bus' })
  @IsString()
  @IsNotEmpty({ message: 'La placa es obligatoria' })
  @MaxLength(20, { message: 'La placa no puede exceder 20 caracteres' })
  placa: string;

  @ApiPropertyOptional({ example: 'Sprinter 515', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelo?: string;

  @ApiPropertyOptional({ example: 'Mercedes-Benz', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @ApiPropertyOptional({ example: 2022, description: 'Año del bus' })
  @IsOptional()
  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(1950, { message: 'El año no es válido' })
  @Max(2100, { message: 'El año no es válido' })
  anno?: number;

  @ApiProperty({ example: 30, minimum: 1, description: 'Capacidad total de asientos' })
  @IsInt({ message: 'La capacidad debe ser un número entero' })
  @Min(1, { message: 'La capacidad debe ser al menos 1' })
  capacidadTotal: number;

  @ApiPropertyOptional({ example: 'https://cdn.busride.app/buses/abc1234.jpg', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoUrl?: string;
}
