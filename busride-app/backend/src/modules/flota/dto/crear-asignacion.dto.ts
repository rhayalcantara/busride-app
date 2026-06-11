import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CrearAsignacionDto {
  @ApiProperty({ description: 'ID del bus a asignar', format: 'uuid' })
  @IsUUID('4', { message: 'El busId debe ser un UUID válido' })
  busId: string;

  @ApiProperty({ description: 'ID de la ruta', format: 'uuid' })
  @IsUUID('4', { message: 'El rutaId debe ser un UUID válido' })
  rutaId: string;

  @ApiProperty({ description: 'ID del conductor', format: 'uuid' })
  @IsUUID('4', { message: 'El conductorId debe ser un UUID válido' })
  conductorId: string;

  @ApiPropertyOptional({
    example: '2026-06-10',
    description: 'Fecha de inicio de la asignación (por defecto, hoy)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaInicio debe ser una fecha válida (YYYY-MM-DD)' })
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de fin (opcional)' })
  @IsOptional()
  @IsDateString({}, { message: 'fechaFin debe ser una fecha válida (YYYY-MM-DD)' })
  fechaFin?: string;
}
