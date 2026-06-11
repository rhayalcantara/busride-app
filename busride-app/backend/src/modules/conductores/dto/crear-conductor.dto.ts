import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CrearConductorDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID del usuario existente (debe tener rol conductor)',
  })
  @IsUUID('4', { message: 'El usuarioId debe ser un UUID válido' })
  usuarioId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'ID de la asociación a la que se vincula el conductor',
  })
  @IsUUID('4', { message: 'El asociacionId debe ser un UUID válido' })
  asociacionId: string;

  @ApiProperty({ example: 'LIC-2026-00123', maxLength: 50, description: 'Número de licencia (único)' })
  @IsString()
  @IsNotEmpty({ message: 'El número de licencia es obligatorio' })
  @MaxLength(50, { message: 'El número de licencia no puede exceder 50 caracteres' })
  licenciaNumero: string;

  @ApiProperty({ example: '2028-12-31', description: 'Fecha de vencimiento de la licencia (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'licenciaVence debe ser una fecha válida (YYYY-MM-DD)' })
  licenciaVence: string;

  @ApiPropertyOptional({ example: 'https://cdn.busride.com/fotos/conductor.jpg', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La URL de la foto no puede exceder 500 caracteres' })
  fotoUrl?: string;

  @ApiPropertyOptional({ example: '001-123456-7', maxLength: 30, description: 'Cuenta bancaria para liquidaciones' })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'La cuenta bancaria no puede exceder 30 caracteres' })
  cuentaBancaria?: string;

  @ApiPropertyOptional({ example: 'Banco Popular', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre del banco no puede exceder 100 caracteres' })
  banco?: string;
}
