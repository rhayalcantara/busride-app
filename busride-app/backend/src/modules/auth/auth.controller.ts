import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, Public, Roles, RolNombre } from '../../common';
import { RegistrarDto } from './dto/registrar.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // B1 (Ola 6): el registro público SOLO crea pasajeros (el DTO ya no acepta rolId;
  // enviarlo responde 400 por forbidNonWhitelisted del ValidationPipe global).
  @Public()
  @Post('registrar')
  @ApiOperation({ summary: 'Registrar nuevo usuario (siempre rol pasajero)' })
  registrar(@Body() dto: RegistrarDto) {
    return this.authService.registrar(dto);
  }

  // B1 (Ola 6): alta de usuarios con rol arbitrario (admin/asociacion/conductor/pasajero).
  // Requiere token de admin; el primer admin proviene del seed 04_seed_admin.sql.
  @Post('usuarios')
  @Roles(RolNombre.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear usuario con rol específico (solo admin)' })
  crearUsuario(@Body() dto: CrearUsuarioDto) {
    return this.authService.crearUsuario(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión (devuelve accessToken + refreshToken)' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotar refresh token y obtener un nuevo par de tokens' })
  refrescar(@Body() dto: RefreshDto) {
    return this.authService.refrescar(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revoca los refresh tokens del usuario)' })
  logout(@CurrentUser('userId') usuarioId: string) {
    return this.authService.logout(usuarioId);
  }
}
