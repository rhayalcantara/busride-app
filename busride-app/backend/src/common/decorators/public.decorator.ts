import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'esPublico';

// Marca un endpoint (o controlador completo) como público: el JwtAuthGuard
// global lo deja pasar sin exigir token. Usar SOLO en endpoints que de verdad
// no requieren identidad (login, registro, refresh).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
