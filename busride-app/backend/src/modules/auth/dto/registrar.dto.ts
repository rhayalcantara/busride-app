import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// B1 (Ola 6): el registro público ya NO acepta rolId — siempre crea un PASAJERO.
// Si el cliente envía rolId, el ValidationPipe global (forbidNonWhitelisted)
// responde 400. Los roles privilegiados se crean vía POST /auth/usuarios (solo admin).
export class RegistrarDto {
  @ApiProperty({ example: 'usuario@correo.com', description: 'Email único del usuario' })
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email: string;

  @ApiProperty({ example: 'Secreta123!', minLength: 8, description: 'Contraseña (mínimo 8 caracteres)' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;
}
