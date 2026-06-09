import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RutasService, BuscarRutasDto } from './rutas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Rutas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Get('buscar')
  @ApiOperation({ summary: 'Buscar rutas disponibles desde origen a destino' })
  buscarRutas(@Query() query: BuscarRutasDto) {
    return this.rutasService.buscarRutasDisponibles(query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear ruta (solo asociación)' })
  crearRuta(@Body() body: any) {
    return this.rutasService.crearRuta(body.asociacionId, body);
  }

  @Get('asociacion/:asociacionId')
  listarPorAsociacion(@Param('asociacionId') id: string) {
    return this.rutasService.listarRutasPorAsociacion(id);
  }

  @Get(':id')
  obtenerRuta(@Param('id') id: string) {
    return this.rutasService.obtenerRuta(id);
  }

  @Get(':id/paradas')
  @ApiOperation({ summary: 'Paradas con coordenadas lat/lng' })
  obtenerParadas(@Param('id') id: string) {
    return this.rutasService.obtenerParadasConUbicacion(id);
  }
}
