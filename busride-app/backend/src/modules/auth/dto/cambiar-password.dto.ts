import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @ApiProperty({ description: 'Contraseña vigente del usuario' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  passwordActual: string;

  @ApiProperty({ minLength: 8, description: 'Nueva contraseña (mínimo 8 caracteres, distinta de la actual)' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  passwordNueva: string;
}
