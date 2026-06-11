import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ParadaRutaDto {
  @ApiProperty({ example: 'Parada Central', maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la parada es obligatorio' })
  @MaxLength(200)
  nombre: string;

  @ApiProperty({ example: 1, description: 'Orden de la parada dentro de la ruta' })
  @IsInt({ message: 'orden debe ser un entero' })
  @Min(1)
  orden: number;

  @ApiProperty({ example: 18.4861 })
  @IsLatitude({ message: 'lat debe ser una latitud válida' })
  lat: number;

  @ApiProperty({ example: -69.9312 })
  @IsLongitude({ message: 'lng debe ser una longitud válida' })
  lng: number;

  @ApiPropertyOptional({ example: 'Frente al parque', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  referencia?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  esTerminal?: boolean;
}

export class CrearRutaDto {
  @ApiProperty({ example: 'Ruta Centro - Aeropuerto', maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la ruta es obligatorio' })
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({ example: 'R-01', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @ApiPropertyOptional({ example: 'Recorrido por la avenida principal', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ example: 50.0, description: 'Tarifa del viaje' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'tarifa debe ser numérica (máx. 2 decimales)' })
  @Min(0, { message: 'La tarifa no puede ser negativa' })
  tarifa: number;

  @ApiPropertyOptional({
    description: 'Solo admin: asociación dueña de la ruta. Para rol asociacion se deriva del JWT.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'asociacionId debe ser un UUID válido' })
  asociacionId?: string;

  @ApiPropertyOptional({ description: 'Polilínea de la ruta en WKT (LINESTRING ...)' })
  @IsOptional()
  @IsString()
  polylineWkt?: string;

  @ApiProperty({ type: [ParadaRutaDto], description: 'Paradas de la ruta (mínimo 2)' })
  @IsArray()
  @ArrayMinSize(2, { message: 'La ruta necesita al menos 2 paradas' })
  @ValidateNested({ each: true })
  @Type(() => ParadaRutaDto)
  paradas: ParadaRutaDto[];
}
