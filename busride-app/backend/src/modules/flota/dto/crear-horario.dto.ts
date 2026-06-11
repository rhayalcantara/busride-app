import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

// Formato de hora HH:mm (la columna TIME de SQL Server se maneja como string)
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CrearHorarioDto {
  @ApiProperty({ description: 'ID de la ruta a la que pertenece el horario', format: 'uuid' })
  @IsUUID('4', { message: 'El rutaId debe ser un UUID válido' })
  rutaId: string;

  @ApiProperty({
    example: 'LMXJV',
    description: 'Días activos de la semana: cada carácter es un día (L,M,X,J,V,S,D)',
  })
  @IsString()
  @Matches(/^[LMXJVSD]{1,7}$/, {
    message: 'diasSemana solo admite los caracteres L, M, X, J, V, S, D (máximo 7)',
  })
  diasSemana: string;

  @ApiProperty({ example: '06:00', description: 'Hora de inicio en formato HH:mm' })
  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm (00:00 a 23:59)' })
  horaInicio: string;

  @ApiProperty({ example: '22:30', description: 'Hora de fin en formato HH:mm' })
  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm (00:00 a 23:59)' })
  horaFin: string;

  @ApiPropertyOptional({ example: 30, minimum: 1, description: 'Frecuencia de salida en minutos' })
  @IsOptional()
  @IsInt({ message: 'La frecuencia debe ser un número entero de minutos' })
  @Min(1, { message: 'La frecuencia mínima es 1 minuto' })
  frecuenciaMin?: number;
}
