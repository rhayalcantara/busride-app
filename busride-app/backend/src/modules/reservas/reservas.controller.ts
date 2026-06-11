import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ConfirmarAbordajeDto } from './dto/confirmar-abordaje.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolNombre, CurrentUser } from '../../common';

@ApiTags('Reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post()
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({ summary: 'Pasajero reserva asiento en un viaje (identidad desde JWT)' })
  crearReserva(@CurrentUser('userId') userId: string, @Body() dto: CrearReservaDto) {
    return this.reservasService.crearReserva(userId, dto);
  }

  @Post('abordar')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Conductor escanea QR y confirma abordaje (identidad desde JWT)' })
  confirmarAbordaje(@CurrentUser('userId') userId: string, @Body() dto: ConfirmarAbordajeDto) {
    return this.reservasService.confirmarAbordaje(userId, dto);
  }

  @Get('mias')
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({ summary: 'Historial de reservas del pasajero autenticado' })
  listarMisReservas(@CurrentUser('userId') userId: string) {
    return this.reservasService.listarMisReservas(userId);
  }
}
