import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoLiquidacion } from '../entities/liquidacion.entity';

export class ListarLiquidacionesDto {
  @ApiPropertyOptional({
    enum: EstadoLiquidacion,
    description: 'Filtrar por estado de la liquidación',
    example: EstadoLiquidacion.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(EstadoLiquidacion, {
    message: 'El estado debe ser PENDIENTE, PAGADA o EN_PROCESO',
  })
  estado?: EstadoLiquidacion;
}
