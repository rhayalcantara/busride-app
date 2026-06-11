import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearBusDto } from './crear-bus.dto';

// Permite editar los datos del bus y activarlo/desactivarlo.
// La asociación dueña no se cambia por esta vía.
export class ActualizarBusDto extends PartialType(OmitType(CrearBusDto, ['asociacionId'] as const)) {
  @ApiPropertyOptional({ description: 'Activar (true) o desactivar (false) el bus' })
  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser booleano' })
  activo?: boolean;
}
