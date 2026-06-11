import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Forma del usuario que adjunta JwtStrategy.validate al request
export interface UsuarioAutenticado {
  userId: string;
  email: string;
  rol: string;
}

// Extrae el usuario autenticado del request.
// Uso: @CurrentUser() usuario: UsuarioAutenticado
//      @CurrentUser('userId') userId: string
export const CurrentUser = createParamDecorator(
  (propiedad: keyof UsuarioAutenticado | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const usuario: UsuarioAutenticado = request.user;

    return propiedad ? usuario?.[propiedad] : usuario;
  },
);
