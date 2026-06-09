import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('paquetes')
  @ApiOperation({ summary: 'Listar paquetes de viajes disponibles' })
  listarPaquetes() {
    return this.walletService.listarPaquetes();
  }

  @Get(':pasajeroId')
  @ApiOperation({ summary: 'Consultar saldo del pasajero' })
  obtenerSaldo(@Param('pasajeroId') id: string) {
    return this.walletService.obtenerSaldo(id);
  }

  @Post(':pasajeroId/comprar')
  @ApiOperation({ summary: 'Comprar paquete de viajes' })
  comprarPaquete(
    @Param('pasajeroId') id: string,
    @Body() body: { paqueteId: number; referenciaExternal: string },
  ) {
    return this.walletService.comprarPaquete(id, body.paqueteId, body.referenciaExternal);
  }

  @Get(':pasajeroId/historial')
  @ApiOperation({ summary: 'Historial de transacciones' })
  historial(@Param('pasajeroId') id: string) {
    return this.walletService.historialTransacciones(id);
  }
}
