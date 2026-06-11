import { Controller, Get, Patch, Param, ParseUUIDPipe, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LiquidacionService } from './liquidacion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolNombre, CurrentUser } from '../../common';
import { PagarLiquidacionDto } from './dto/pagar-liquidacion.dto';

// El conductor solo consulta SUS liquidaciones (identidad desde el JWT, F4).
// RolesGuard ya es global (APP_GUARD).
@ApiTags('Liquidaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('liquidaciones')
export class LiquidacionController {
  constructor(private readonly liquidacionService: LiquidacionService) {}

  @Get('mias')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Historial de liquidaciones del conductor autenticado' })
  misLiquidaciones(@CurrentUser('userId') usuarioId: string) {
    return this.liquidacionService.obtenerMisLiquidaciones(usuarioId);
  }

  @Get('mias/resumen')
  @Roles(RolNombre.CONDUCTOR)
  @ApiOperation({ summary: 'Resumen de liquidaciones del conductor autenticado por período' })
  @ApiQuery({ name: 'inicio', required: false, description: 'Fecha inicio del período (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fin', required: false, description: 'Fecha fin del período (YYYY-MM-DD)' })
  miResumen(
    @CurrentUser('userId') usuarioId: string,
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
  ) {
    return this.liquidacionService.resumenMisLiquidaciones(usuarioId, inicio, fin);
  }

  @Patch(':id/pagar')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({ summary: 'Marcar liquidación como pagada (solo admin)' })
  marcarPagada(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PagarLiquidacionDto) {
    return this.liquidacionService.marcarPagada(id, dto.referenciaPago);
  }
}
