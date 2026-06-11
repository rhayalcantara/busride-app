import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

// Valida el JWT del handshake de Socket.IO. El cliente debe enviar el token
// en `auth: { token }` al conectar, o en el header Authorization (Bearer).
// El payload verificado se adjunta a client.data.user.
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extraerToken(client);

    if (!token) {
      throw new WsException('Token de autenticación no proporcionado');
    }

    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Token de autenticación inválido o expirado');
    }
  }

  private extraerToken(client: Socket): string | undefined {
    // Prioridad: auth del handshake, luego header Authorization
    const tokenAuth = client.handshake.auth?.token;
    if (tokenAuth) {
      return tokenAuth;
    }

    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return undefined;
  }
}
