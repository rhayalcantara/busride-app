import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common';

/**
 * Endpoint de salud para healthchecks (Docker HEALTHCHECK, load balancers).
 * Público a propósito: los probes no tienen credenciales. No toca la BD ni
 * expone información sensible — solo confirma que el proceso HTTP responde.
 */
@ApiTags('salud')
@Controller('salud')
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Healthcheck del servicio' })
  salud(): { estado: string } {
    return { estado: 'ok' };
  }
}
