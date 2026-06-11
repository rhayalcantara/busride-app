import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolNombre, RolesGuard, CurrentUser } from '../../common';
import { AsociacionesService } from './asociaciones.service';
import { CrearAsociacionDto } from './dto/crear-asociacion.dto';
import { ActualizarAsociacionDto } from './dto/actualizar-asociacion.dto';
import { VincularUsuarioAdminDto } from './dto/vincular-usuario-admin.dto';

@ApiTags('Asociaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asociaciones')
export class AsociacionesController {
  constructor(private readonly asociacionesService: AsociacionesService) {}

  @Post()
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Crear asociación en estado PENDIENTE (solo admin)' })
  crear(@Body() dto: CrearAsociacionDto) {
    return this.asociacionesService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar asociaciones activas (cualquier usuario autenticado)' })
  listarActivas() {
    return this.asociacionesService.listarActivas();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una asociación con sus rutas' })
  obtenerDetalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.asociacionesService.obtenerConRutas(id);
  }

  @Patch(':id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Actualizar datos de la asociación (solo admin)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAsociacionDto,
  ) {
    return this.asociacionesService.actualizar(id, dto);
  }

  @Patch(':id/aprobar')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Aprobar y activar la asociación; registra el admin aprobador (solo admin)' })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') adminUserId: string,
  ) {
    return this.asociacionesService.aprobar(id, adminUserId);
  }

  @Patch(':id/usuario-admin')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Vincular el usuario administrador de la asociación (solo admin)' })
  vincularUsuarioAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularUsuarioAdminDto,
  ) {
    return this.asociacionesService.vincularUsuarioAdmin(id, dto.usuarioId);
  }
}
