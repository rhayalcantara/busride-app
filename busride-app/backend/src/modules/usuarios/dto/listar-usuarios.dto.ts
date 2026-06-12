import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RolNombre } from '../../../common';

export class ListarUsuariosDto {
  @ApiPropertyOptional({
    enum: RolNombre,
    description: 'Filtrar por nombre de rol',
    example: RolNombre.CONDUCTOR,
  })
  @IsOptional()
  @IsEnum(RolNombre, {
    message: 'El rol debe ser uno de: admin, asociacion, conductor, pasajero',
  })
  rol?: RolNombre;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Número de página (desde 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  pagina?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Resultados por página (máx. 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limite?: number = 20;
}
