import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

// Guard JWT registrado como APP_GUARD (T-12). Reglas:
// 1. Si el handler/clase declara @Public() → acceso libre (login, registrar, refresh).
// 2. Si el contexto NO es HTTP (p. ej. 'ws') → true sin tocar el request: los guards
//    globales de Nest también se aplican a los gateways y romperían el handshake del
//    tracking; el gateway ya se protege con su propio WsJwtGuard por mensaje.
// 3. Resto: valida el Bearer token con la estrategia 'jwt' de Passport.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') {
      return true;
    }

    const esPublico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    return super.canActivate(context);
  }
}
