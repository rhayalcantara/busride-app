import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CambiarEstadoDto {
  @ApiProperty({ example: false, description: 'true = activar usuario, false = desactivar' })
  @IsBoolean({ message: 'El campo activo debe ser booleano' })
  activo: boolean;
}
