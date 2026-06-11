import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

// El conductor se resuelve desde el JWT (usuario_id → conductores), nunca del body (F4)
export class IniciarViajeDto {
  @ApiProperty({ description: 'ID de la asignación bus-ruta activa con la que inicia el viaje' })
  @IsUUID('4', { message: 'El asignacionId debe ser un UUID válido' })
  asignacionId: string;
}
