import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReservasService, CrearReservaDto, ConfirmarAbordajeDto } from './reservas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  @ApiOperation({ summary: 'Pasajero reserva asiento en un viaje' })
  crearReserva(@Body() dto: CrearReservaDto) {
    return this.reservasService.crearReserva(dto);
  }

  @Post('abordar')
  @ApiOperation({ summary: 'Conductor escanea QR y confirma abordaje' })
  confirmarAbordaje(@Body() dto: ConfirmarAbordajeDto) {
    return this.reservasService.confirmarAbordaje(dto);
  }

  @Get('pasajero/:pasajeroId')
  @ApiOperation({ summary: 'Historial de reservas del pasajero' })
  listarReservas(@Param('pasajeroId') id: string) {
    return this.reservasService.listarReservasPasajero(id);
  }
}
