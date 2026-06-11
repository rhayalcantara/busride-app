import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearAsociacionDto } from './crear-asociacion.dto';

// Todos los campos opcionales; el usuario administrador se cambia
// exclusivamente por PATCH /asociaciones/:id/usuario-admin
export class ActualizarAsociacionDto extends PartialType(
  OmitType(CrearAsociacionDto, ['usuarioId'] as const),
) {}
