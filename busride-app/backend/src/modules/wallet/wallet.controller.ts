import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolNombre } from '../../common';
import { ComprarPaqueteDto } from './dto/comprar-paquete.dto';
import { HistorialQueryDto } from './dto/historial-query.dto';

// La identidad del pasajero se deriva SIEMPRE del JWT (@CurrentUser),
// nunca de params o body (resuelve F4). RolesGuard es global (APP_GUARD).
@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Público autenticado: cualquier usuario con JWT válido puede ver el catálogo
  @Get('paquetes')
  @ApiOperation({ summary: 'Listar paquetes de viajes disponibles' })
  listarPaquetes() {
    return this.walletService.listarPaquetes();
  }

  @Get('mi-saldo')
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({ summary: 'Consultar el saldo del pasajero autenticado' })
  miSaldo(@CurrentUser('userId') userId: string) {
    return this.walletService.obtenerMiSaldo(userId);
  }

  @Post('comprar')
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({ summary: 'Comprar paquete de viajes (idempotente por referenciaExterna)' })
  comprarPaquete(@CurrentUser('userId') userId: string, @Body() dto: ComprarPaqueteDto) {
    return this.walletService.comprarPaquete(userId, dto);
  }

  @Get('historial')
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({ summary: 'Historial de transacciones del pasajero autenticado' })
  historial(@CurrentUser('userId') userId: string, @Query() query: HistorialQueryDto) {
    return this.walletService.historialTransacciones(userId, query.limite);
  }
}
