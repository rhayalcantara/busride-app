import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class VincularUsuarioAdminDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID del usuario que será administrador de la asociación (FK usuario_id)',
  })
  @IsUUID('4', { message: 'El usuarioId debe ser un UUID válido' })
  usuarioId: string;
}
