import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { RegistrarDto } from './registrar.dto';

// B1 (Ola 6): alta de usuarios con rol arbitrario — SOLO admin (POST /auth/usuarios).
export class CrearUsuarioDto extends RegistrarDto {
  @ApiProperty({
    example: 3,
    description: 'ID del rol (tabla roles): 1=admin, 2=asociacion, 3=conductor, 4=pasajero',
  })
  @IsInt({ message: 'El rolId debe ser un número entero' })
  rolId: number;
}
