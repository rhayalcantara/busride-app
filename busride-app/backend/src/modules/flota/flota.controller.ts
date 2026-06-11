import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolNombre } from '../../common';
import { FlotaService } from './flota.service';
import { CrearBusDto } from './dto/crear-bus.dto';
import { ActualizarBusDto } from './dto/actualizar-bus.dto';
import { CrearHorarioDto } from './dto/crear-horario.dto';
import { CrearAsignacionDto } from './dto/crear-asignacion.dto';

// RolesGuard ya es global (APP_GUARD, registrado en T-04); aquí solo declaramos @Roles.
@ApiTags('Flota')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flota')
export class FlotaController {
  constructor(private readonly flotaService: FlotaService) {}

  // ============================================================
  // Buses
  // ============================================================

  @Post('buses')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Crear bus (solo admin/asociación)' })
  crearBus(@Body() dto: CrearBusDto) {
    return this.flotaService.crearBus(dto);
  }

  // B6 (Ola 6, decisión documentada): este listado queda abierto a cualquier
  // usuario autenticado. La flota de una asociación es información operativa de
  // solo lectura y no sensible (equiparable al listado público de asociaciones);
  // el riesgo de IDOR real (iniciar viaje con asignación ajena) quedó cerrado en B2.
  @Get('buses/asociacion/:asociacionId')
  @ApiOperation({ summary: 'Listar buses de una asociación (lectura, cualquier autenticado)' })
  listarBusesPorAsociacion(@Param('asociacionId', ParseUUIDPipe) asociacionId: string) {
    return this.flotaService.listarBusesPorAsociacion(asociacionId);
  }

  @Patch('buses/:id')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Editar bus o activarlo/desactivarlo (solo admin/asociación)' })
  actualizarBus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarBusDto) {
    return this.flotaService.actualizarBus(id, dto);
  }

  // ============================================================
  // Horarios
  // ============================================================

  @Post('horarios')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Crear horario para una ruta (solo admin/asociación)' })
  crearHorario(@Body() dto: CrearHorarioDto) {
    return this.flotaService.crearHorario(dto);
  }

  @Get('horarios/ruta/:rutaId')
  @ApiOperation({ summary: 'Horarios de una ruta (cualquier usuario autenticado)' })
  listarHorariosPorRuta(@Param('rutaId', ParseUUIDPipe) rutaId: string) {
    return this.flotaService.listarHorariosPorRuta(rutaId);
  }

  // ============================================================
  // Asignaciones bus-ruta-conductor
  // ============================================================

  @Post('asignaciones')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({
    summary: 'Crear asignación bus-ruta-conductor (solo admin/asociación)',
    description:
      'Rechaza con 409 si el bus o el conductor ya tienen otra asignación activa.',
  })
  crearAsignacion(@Body() dto: CrearAsignacionDto) {
    return this.flotaService.crearAsignacion(dto);
  }

  @Patch('asignaciones/:id/desactivar')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Desactivar una asignación (solo admin/asociación)' })
  desactivarAsignacion(@Param('id', ParseUUIDPipe) id: string) {
    return this.flotaService.desactivarAsignacion(id);
  }

  // B6 (Ola 6): la app del conductor usa /mias (identidad derivada del JWT);
  // el listado por :conductorId queda restringido a gestión (admin/asociación).
  @Get('asignaciones/mias')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({
    summary: 'Asignaciones activas del conductor autenticado',
    description: 'Usado por la app del conductor para iniciar viaje.',
  })
  listarMisAsignaciones(@CurrentUser('userId') usuarioId: string) {
    return this.flotaService.listarMisAsignaciones(usuarioId);
  }

  @Get('asignaciones/conductor/:conductorId')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Asignaciones activas de un conductor (solo admin/asociación)' })
  listarAsignacionesPorConductor(@Param('conductorId', ParseUUIDPipe) conductorId: string) {
    return this.flotaService.listarAsignacionesActivasPorConductor(conductorId);
  }
}
