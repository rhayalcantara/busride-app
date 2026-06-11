import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CalificarConductorDto {
  @ApiProperty({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'ID del viaje en el que el pasajero abordó con este conductor',
  })
  @IsUUID('4', { message: 'El viajeId debe ser un UUID válido' })
  viajeId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Calificación de 1 a 5 estrellas' })
  @IsInt({ message: 'Las estrellas deben ser un número entero' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  estrellas: number;

  @ApiPropertyOptional({ example: 'Muy buen servicio, conducción segura', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El comentario no puede exceder 500 caracteres' })
  comentario?: string;
}
