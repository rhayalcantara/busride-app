import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ESTADO_ASOCIACION, EstadoAsociacion } from '../asociaciones.service';

export class ListarAsociacionesDto {
  @ApiPropertyOptional({
    enum: Object.values(ESTADO_ASOCIACION),
    description: 'Filtrar por estado (solo admin); sin el parámetro se listan las ACTIVAS',
    example: ESTADO_ASOCIACION.PENDIENTE,
  })
  @IsOptional()
  @IsIn(Object.values(ESTADO_ASOCIACION), {
    message: 'El estado debe ser PENDIENTE, ACTIVA o SUSPENDIDA',
  })
  estado?: EstadoAsociacion;
}
