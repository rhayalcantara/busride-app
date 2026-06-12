import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ViajesService } from './viajes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolNombre, CurrentUser } from '../../common';
import { IniciarViajeDto } from './dto/iniciar-viaje.dto';
import { ActualizarPosicionDto } from './dto/actualizar-posicion.dto';

// La identidad del conductor se deriva SIEMPRE del JWT (F4):
// el service resuelve usuario_id → conductores. RolesGuard ya es global (APP_GUARD).
@ApiTags('Viajes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  @Post('iniciar')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Conductor autenticado inicia ruta' })
  iniciar(@CurrentUser('userId') usuarioId: string, @Body() dto: IniciarViajeDto) {
    return this.viajesService.iniciarViaje(usuarioId, dto.asignacionId);
  }

  @Patch(':id/posicion')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Actualizar posición GPS del bus (solo el conductor del viaje)' })
  actualizarPosicion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') usuarioId: string,
    @Body() dto: ActualizarPosicionDto,
  ) {
    return this.viajesService.actualizarPosicionComoConductor(id, usuarioId, dto.lat, dto.lng);
  }

  @Post(':id/finalizar')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Conductor autenticado finaliza ruta y genera liquidación' })
  finalizar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') usuarioId: string) {
    return this.viajesService.finalizarViaje(id, usuarioId);
  }

  @Get('mi-activo')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Viaje activo del conductor autenticado' })
  miViajeActivo(@CurrentUser('userId') usuarioId: string) {
    return this.viajesService.obtenerMiViajeActivo(usuarioId);
  }

  @Get(':id/parada/:paradaId/pasajeros')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Pasajeros esperando en una parada (vista conductor)' })
  pasajerosEnParada(
    @Param('id', ParseUUIDPipe) viajeId: string,
    @Param('paradaId', ParseIntPipe) paradaId: number,
  ) {
    return this.viajesService.pasajerosEnParada(viajeId, paradaId);
  }

  // OJO: declarada al FINAL para que ':id' no capture 'mi-activo' ni 'iniciar'.
  // Sin @Roles: cualquier usuario autenticado (el pasajero la necesita para
  // pintar el viaje en vivo antes del primer evento de socket).
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un viaje: estado, ruta, asientos y última posición (cualquier usuario autenticado)' })
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.viajesService.obtenerDetalle(id);
  }
}
