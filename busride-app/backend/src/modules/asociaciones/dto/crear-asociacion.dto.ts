import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearAsociacionDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID del usuario administrador de la asociación (FK usuario_id)',
  })
  @IsUUID('4', { message: 'El usuarioId debe ser un UUID válido' })
  usuarioId: string;

  @ApiProperty({ example: 'Asociación de Transportistas del Este', maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @ApiPropertyOptional({ example: '131-12345-6', description: 'RNC (registro nacional de contribuyente)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El RNC no puede exceder 20 caracteres' })
  rnc?: string;

  @ApiPropertyOptional({ example: 'Av. Las Américas #45, Santo Domingo Este', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'La dirección no puede exceder 300 caracteres' })
  direccion?: string;

  @ApiPropertyOptional({ example: '809-555-1234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  telefono?: string;

  @ApiPropertyOptional({ example: 'https://cdn.busride.do/logos/asoc-este.png', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La URL del logo no puede exceder 500 caracteres' })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 15.0,
    description: 'Porcentaje de comisión que retiene la plataforma (0-100). Por defecto 15.00',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La comisión debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'La comisión no puede ser negativa' })
  @Max(100, { message: 'La comisión no puede exceder 100%' })
  comisionPct?: number;
}
