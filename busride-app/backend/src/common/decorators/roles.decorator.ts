import { SetMetadata } from '@nestjs/common';

// Nombres de rol tal como existen en la tabla `roles` de la BD
// (ver database/init/02_schema.sql — INSERT INTO roles)
export enum RolNombre {
  ADMIN      = 'admin',
  ASOCIACION = 'asociacion',
  CONDUCTOR  = 'conductor',
  PASAJERO   = 'pasajero',
}

export const ROLES_KEY = 'roles';

// Restringe un endpoint a los roles indicados.
// Uso: @Roles(RolNombre.ADMIN, RolNombre.CONDUCTOR) junto con RolesGuard
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
