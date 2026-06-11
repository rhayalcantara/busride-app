import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolNombre } from '../../common';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado (con rol, sin datos sensibles)' })
  obtenerPerfil(@CurrentUser('userId') usuarioId: string) {
    return this.usuariosService.obtenerPerfil(usuarioId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar nombre, apellido o teléfono del propio perfil' })
  actualizarPerfil(
    @CurrentUser('userId') usuarioId: string,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.usuariosService.actualizarPerfil(usuarioId, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Cambiar contraseña (requiere la contraseña actual)' })
  cambiarPassword(
    @CurrentUser('userId') usuarioId: string,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.usuariosService.cambiarPassword(usuarioId, dto);
  }

  @Get()
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Listado paginado de usuarios (solo admin)' })
  listar(@Query() query: ListarUsuariosDto) {
    return this.usuariosService.listar(query.pagina, query.limite);
  }

  @Patch(':id/estado')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Activar o desactivar un usuario (solo admin)' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.usuariosService.cambiarEstado(id, dto.activo);
  }
}
