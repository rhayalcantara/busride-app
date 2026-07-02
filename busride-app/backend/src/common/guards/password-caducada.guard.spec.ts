import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PasswordCaducadaGuard } from './password-caducada.guard';

describe('PasswordCaducadaGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const guard = new PasswordCaducadaGuard(reflector, config);

  const contexto = (tipo: string, user?: unknown): ExecutionContext =>
    ({
      getType: () => tipo,
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('deja pasar contextos no-HTTP (gateways WS)', () => {
    expect(guard.canActivate(contexto('ws'))).toBe(true);
  });

  it('deja pasar sin user (rutas @Public) o sin flag', () => {
    expect(guard.canActivate(contexto('http', undefined))).toBe(true);
    expect(guard.canActivate(contexto('http', { debeCambiarPassword: false }))).toBe(true);
  });

  it('con flag pero fuera de producción deja pasar (dev/e2e usan el seed)', () => {
    (config.get as jest.Mock).mockReturnValue('development');
    expect(guard.canActivate(contexto('http', { debeCambiarPassword: true }))).toBe(true);
  });

  it('en producción bloquea con 403 salvo rutas @PermitirPasswordCaducada', () => {
    (config.get as jest.Mock).mockReturnValue('production');

    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(() => guard.canActivate(contexto('http', { debeCambiarPassword: true }))).toThrow(
      ForbiddenException,
    );

    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(contexto('http', { debeCambiarPassword: true }))).toBe(true);
  });
});
