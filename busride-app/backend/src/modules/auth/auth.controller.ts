import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registrar')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  registrar(@Body() body: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    rolId: number;
  }) {
    return this.authService.registrar(
      body.email, body.password, body.nombre, body.apellido, body.rolId,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
}
