import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LiquidacionService } from './liquidacion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Liquidaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('liquidaciones')
export class LiquidacionController {
  constructor(private readonly liquidacionService: LiquidacionService) {}

  @Get('conductor/:conductorId')
  @ApiOperation({ summary: 'Historial de liquidaciones del conductor' })
  listarLiquidaciones(@Param('conductorId') id: string) {
    return this.liquidacionService.obtenerLiquidacionesConductor(id);
  }

  @Get('conductor/:conductorId/resumen')
  @ApiOperation({ summary: 'Resumen de liquidaciones por período' })
  resumen(
    @Param('conductorId') id: string,
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
  ) {
    return this.liquidacionService.resumenLiquidacionPeriodo(id, inicio, fin);
  }

  @Patch(':id/pagar')
  @ApiOperation({ summary: 'Marcar liquidación como pagada (admin)' })
  marcarPagada(@Param('id') id: string, @Body() body: { referenciaPago: string }) {
    return this.liquidacionService.marcarPagada(id, body.referenciaPago);
  }
}
