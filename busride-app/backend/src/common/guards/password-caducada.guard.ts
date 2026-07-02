import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PERMITIR_PASSWORD_CADUCADA_KEY } from '../decorators/permitir-password-caducada.decorator';

/**
 * Bloquea a usuarios con credencial provisional (debe_cambiar_password = 1,
 * p. ej. el admin seed) hasta que la cambien vía POST /auth/cambiar-password.
 *
 * - El estado viaja como claim `dcp` en el access token (lo puebla JwtStrategy):
 *   no hay lookup a BD por request. Tras el cambio se emite un par nuevo sin claim.
 * - Solo actúa en producción: en dev/e2e la credencial seed es de trabajo y el
 *   objetivo (cerrar la puerta trasera pública de producción) no aplica.
 * - Rutas @Public no traen user (JwtAuthGuard no corre) → pasan solas.
 * - @PermitirPasswordCaducada() exime lo imprescindible (cambiar-password, logout).
 */
@Injectable()
export class PasswordCaducadaGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user?.debeCambiarPassword) return true;

    if (this.config.get<string>('NODE_ENV') !== 'production') return true;

    const exento = this.reflector.getAllAndOverride<boolean>(PERMITIR_PASSWORD_CADUCADA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exento) return true;

    throw new ForbiddenException(
      'Debes cambiar tu contraseña provisional antes de continuar (POST /auth/cambiar-password)',
    );
  }
}
