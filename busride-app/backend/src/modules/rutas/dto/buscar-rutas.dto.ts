import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

export class BuscarRutasDto {
  @ApiProperty({ example: 18.4861, description: 'Latitud del punto de origen' })
  @Type(() => Number)
  @IsLatitude({ message: 'latOrigen debe ser una latitud válida' })
  latOrigen: number;

  @ApiProperty({ example: -69.9312, description: 'Longitud del punto de origen' })
  @Type(() => Number)
  @IsLongitude({ message: 'lngOrigen debe ser una longitud válida' })
  lngOrigen: number;

  @ApiProperty({ example: 18.4539, description: 'Latitud del punto de destino' })
  @Type(() => Number)
  @IsLatitude({ message: 'latDestino debe ser una latitud válida' })
  latDestino: number;

  @ApiProperty({ example: -69.9395, description: 'Longitud del punto de destino' })
  @Type(() => Number)
  @IsLongitude({ message: 'lngDestino debe ser una longitud válida' })
  lngDestino: number;

  @ApiPropertyOptional({ example: 500, description: 'Radio de búsqueda en metros (default 500)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'radioMetros debe ser un entero' })
  @Min(50, { message: 'radioMetros mínimo: 50' })
  @Max(5000, { message: 'radioMetros máximo: 5000' })
  radioMetros?: number;
}
