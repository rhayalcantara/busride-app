import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * B3 (Ola 6): variante del ThrottlerGuard para registrarlo como APP_GUARD.
 *
 * Los guards globales también corren en los gateways WS (mensajes Socket.IO),
 * donde el ThrottlerGuard de @nestjs/throttler v5 no sabe extraer req/res y
 * fallaría. Igual que hace el JwtAuthGuard global, en contextos no-HTTP se
 * devuelve true y el rate limit aplica solo a peticiones HTTP.
 */
@Injectable()
export class ThrottlerHttpGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }
}
