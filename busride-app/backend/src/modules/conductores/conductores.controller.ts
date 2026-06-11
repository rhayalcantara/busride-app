import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConductoresService } from './conductores.service';
import { CrearConductorDto } from './dto/crear-conductor.dto';
import { CalificarConductorDto } from './dto/calificar-conductor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolNombre } from '../../common';

@ApiTags('Conductores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conductores')
export class ConductoresController {
  constructor(private readonly conductoresService: ConductoresService) {}

  @Post()
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({
    summary: 'Alta de conductor',
    description:
      'Vincula un usuario existente con rol conductor a una asociación, con sus datos de licencia. Solo admin o asociación.',
  })
  crearConductor(@Body() dto: CrearConductorDto) {
    return this.conductoresService.crearConductor(dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Perfil del conductor autenticado',
    description:
      'Resuelve el conductor por el usuario del JWT e incluye su calificación promedio.',
  })
  obtenerMiPerfil(@CurrentUser('userId') usuarioId: string) {
    return this.conductoresService.obtenerPerfilPorUsuarioId(usuarioId);
  }

  @Get('asociacion/:asociacionId')
  @Roles(RolNombre.ADMIN, RolNombre.ASOCIACION)
  @ApiOperation({ summary: 'Listado de conductores de una asociación' })
  @ApiParam({ name: 'asociacionId', description: 'ID de la asociación' })
  listarPorAsociacion(@Param('asociacionId', ParseUUIDPipe) asociacionId: string) {
    return this.conductoresService.listarPorAsociacion(asociacionId);
  }

  @Post(':id/calificar')
  @Roles(RolNombre.PASAJERO)
  @ApiOperation({
    summary: 'Pasajero califica a un conductor',
    description:
      'Valida que el pasajero autenticado abordó el viaje indicado con este conductor, registra la calificación y recalcula el promedio vía sp_actualizar_calificacion_conductor.',
  })
  @ApiParam({ name: 'id', description: 'ID del conductor a calificar' })
  calificar(
    @Param('id', ParseUUIDPipe) conductorId: string,
    @CurrentUser('userId') usuarioId: string,
    @Body() dto: CalificarConductorDto,
  ) {
    return this.conductoresService.calificar(conductorId, usuarioId, dto);
  }
}
