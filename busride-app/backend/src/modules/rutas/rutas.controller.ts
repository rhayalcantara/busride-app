import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RutasService } from './rutas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolNombre, UsuarioAutenticado } from '../../common';
import { BuscarRutasDto } from './dto/buscar-rutas.dto';
import { CrearRutaDto } from './dto/crear-ruta.dto';

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
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Crear ruta con paradas (asociación: la suya; admin: indica asociacionId)' })
  crearRuta(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CrearRutaDto) {
    return this.rutasService.crearRutaComoUsuario(user, dto);
  }

  @Get('asociacion/:asociacionId')
  @ApiOperation({ summary: 'Rutas activas de una asociación' })
  listarPorAsociacion(@Param('asociacionId', ParseUUIDPipe) id: string) {
    return this.rutasService.listarRutasPorAsociacion(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una ruta con paradas y asociación' })
  obtenerRuta(@Param('id', ParseUUIDPipe) id: string) {
    return this.rutasService.obtenerRuta(id);
  }

  @Get(':id/paradas')
  @ApiOperation({ summary: 'Paradas con coordenadas lat/lng' })
  obtenerParadas(@Param('id', ParseUUIDPipe) id: string) {
    return this.rutasService.obtenerParadasConUbicacion(id);
  }
}
