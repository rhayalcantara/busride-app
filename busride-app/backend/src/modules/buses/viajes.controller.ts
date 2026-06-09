import { Controller, Post, Patch, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ViajesService } from './viajes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Viajes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  @Post('iniciar')
  @ApiOperation({ summary: 'Conductor inicia ruta' })
  iniciar(@Body() body: { conductorId: string; asignacionId: string }) {
    return this.viajesService.iniciarViaje(body.conductorId, body.asignacionId);
  }

  @Patch(':id/posicion')
  @ApiOperation({ summary: 'Actualizar posición GPS del bus' })
  actualizarPosicion(@Param('id') id: string, @Body() body: { lat: number; lng: number }) {
    return this.viajesService.actualizarPosicion(id, body.lat, body.lng);
  }

  @Post(':id/finalizar')
  @ApiOperation({ summary: 'Conductor finaliza ruta y genera liquidación' })
  finalizar(@Param('id') id: string, @Body() body: { conductorId: string }) {
    return this.viajesService.finalizarViaje(id, body.conductorId);
  }

  @Get('conductor/:conductorId/activo')
  @ApiOperation({ summary: 'Obtener viaje activo del conductor' })
  viajeActivo(@Param('conductorId') id: string) {
    return this.viajesService.obtenerViajeActivo(id);
  }

  @Get(':id/parada/:paradaId/pasajeros')
  @ApiOperation({ summary: 'Pasajeros esperando en una parada (vista conductor)' })
  pasajerosEnParada(@Param('id') viajeId: string, @Param('paradaId') paradaId: string) {
    return this.viajesService['dataSource'].query(
      `EXEC sp_pasajeros_en_parada @viaje_id = @0, @parada_id = @1`,
      [viajeId, parseInt(paradaId)],
    );
  }
}
