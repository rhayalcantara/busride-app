import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolNombre, RolesGuard, CurrentUser } from '../../common';
import { AsociacionesService } from './asociaciones.service';
import { CrearAsociacionDto } from './dto/crear-asociacion.dto';
import { ActualizarAsociacionDto } from './dto/actualizar-asociacion.dto';
import { VincularUsuarioAdminDto } from './dto/vincular-usuario-admin.dto';
import { ListarAsociacionesDto } from './dto/listar-asociaciones.dto';

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
  @ApiOperation({
    summary: 'Listar asociaciones: activas por defecto; un admin puede filtrar por ?estado=',
  })
  listar(@CurrentUser('rol') rol: string, @Query() query: ListarAsociacionesDto) {
    return this.asociacionesService.listar(rol, query.estado);
  }

  // OJO: declarada ANTES de GET :id para que ':id' no capture 'mia'
  @Get('mia')
  @Roles(RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Asociación vinculada al usuario autenticado (rol asociacion)' })
  miAsociacion(@CurrentUser('userId') usuarioId: string) {
    return this.asociacionesService.obtenerMia(usuarioId);
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
