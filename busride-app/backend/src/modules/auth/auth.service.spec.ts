import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Pasajero } from '../wallet/entities/pasajero.entity';
import { WalletPasajero } from '../wallet/entities/wallet.entity';
import { TokenRefresco } from './entities/token-refresco.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  // Mocks de repositorios
  const usuarioRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const rolRepo = {
    findOne: jest.fn(),
  };
  const tokenRefrescoRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'token-nuevo-id', ...data })),
  };

  // Mock de queryRunner para el registro transaccional
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const jwtService = {
    sign: jest.fn(() => 'access-token-firmado'),
  };
  const configService = {
    get: jest.fn((_clave: string, porDefecto?: unknown) => porDefecto),
  };

  const usuarioBase = {
    id: 'usuario-1',
    email: 'juan@correo.com',
    passwordHash: '$2b$12$hash-almacenado',
    nombre: 'Juan',
    apellido: 'Pérez',
    activo: true,
    debeCambiarPassword: false,
    rol: { id: 4, nombre: 'pasajero' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: getRepositoryToken(Rol), useValue: rolRepo },
        { provide: getRepositoryToken(TokenRefresco), useValue: tokenRefrescoRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('lanza UnauthorizedException si el usuario no existe (o está inactivo)', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexiste@correo.com', password: 'Secreta123!' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: usuarioBase.email, password: 'incorrecta' }),
      ).rejects.toThrow(UnauthorizedException);

      // No debe emitirse ningún token si la password no valida
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(tokenRefrescoRepo.save).not.toHaveBeenCalled();
    });

    it('con credenciales válidas devuelve accessToken + refreshToken + usuario sin passwordHash', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usuarioRepo.update.mockResolvedValue(undefined);

      const resultado = await service.login({
        email: usuarioBase.email,
        password: 'Secreta123!',
      });

      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(typeof resultado.refreshToken).toBe('string');
      expect(resultado.refreshToken.length).toBeGreaterThan(0);
      expect(resultado.usuario).toEqual({
        id: usuarioBase.id,
        nombre: usuarioBase.nombre,
        apellido: usuarioBase.apellido,
        email: usuarioBase.email,
        rol: 'pasajero',
        debeCambiarPassword: false,
      });
      expect(resultado.usuario).not.toHaveProperty('passwordHash');

      // Actualiza ultimoLogin y persiste el hash del refresh (no el token plano)
      expect(usuarioRepo.update).toHaveBeenCalledWith(
        usuarioBase.id,
        expect.objectContaining({ ultimoLogin: expect.any(Date) }),
      );
      expect(tokenRefrescoRepo.save).toHaveBeenCalledTimes(1);
      const guardado = tokenRefrescoRepo.create.mock.calls[0][0];
      expect(guardado.token).not.toBe(resultado.refreshToken);
      expect(guardado.token).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    });
  });

  // B1 (Ola 6): el registro público ya no recibe rolId — siempre crea PASAJERO.
  describe('registrar', () => {
    const dtoRegistro = {
      email: 'nuevo@correo.com',
      password: 'Secreta123!',
      nombre: 'Ana',
      apellido: 'Gómez',
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hash-nuevo');
      // create devuelve el objeto y save le asigna id según la entidad
      queryRunner.manager.create.mockImplementation((entidad: unknown, data: object) => ({
        ...data,
        __entidad: entidad,
      }));
      queryRunner.manager.save.mockImplementation(async (obj: Record<string, unknown>) => {
        if (obj.__entidad === Usuario) obj.id = 'usuario-nuevo';
        if (obj.__entidad === Pasajero) obj.id = 'pasajero-nuevo';
        if (obj.__entidad === WalletPasajero) obj.id = 'wallet-nueva';
        return obj;
      });
    });

    it('lanza ConflictException si el email ya está registrado (sin abrir transacción)', async () => {
      rolRepo.findOne.mockResolvedValue({ id: 4, nombre: 'pasajero' });
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });

      await expect(service.registrar(dtoRegistro)).rejects.toThrow(ConflictException);

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('lanza InternalServerErrorException si el seed del rol pasajero no existe', async () => {
      rolRepo.findOne.mockResolvedValue(null);

      await expect(service.registrar(dtoRegistro)).rejects.toThrow(InternalServerErrorException);
      expect(rolRepo.findOne).toHaveBeenCalledWith({ where: { nombre: 'pasajero' } });
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('siempre crea PASAJERO: usuario + pasajero + wallet en la misma transacción y hace commit', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      rolRepo.findOne.mockResolvedValue({ id: 4, nombre: 'pasajero' });

      const resultado = await service.registrar(dtoRegistro);

      // El rol se resuelve por NOMBRE (pasajero), nunca del cliente
      expect(rolRepo.findOne).toHaveBeenCalledWith({ where: { nombre: 'pasajero' } });

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();

      // Se crean las 3 entidades dentro del queryRunner
      expect(queryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Usuario,
        expect.objectContaining({
          email: dtoRegistro.email,
          passwordHash: '$2b$12$hash-nuevo',
          rolId: 4,
        }),
      );
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Pasajero,
        expect.objectContaining({ usuarioId: 'usuario-nuevo' }),
      );
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        WalletPasajero,
        expect.objectContaining({ pasajeroId: 'pasajero-nuevo', saldoViajes: 0, saldoDinero: 0 }),
      );

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      expect(resultado.usuarioId).toBe('usuario-nuevo');
    });

    it('si falla a mitad de la transacción hace rollback y propaga el error', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      rolRepo.findOne.mockResolvedValue({ id: 4, nombre: 'pasajero' });

      // El segundo save (pasajero) revienta
      queryRunner.manager.save
        .mockImplementationOnce(async (obj: Record<string, unknown>) => {
          obj.id = 'usuario-nuevo';
          return obj;
        })
        .mockRejectedValueOnce(new Error('fallo de BD'));

      await expect(service.registrar(dtoRegistro)).rejects.toThrow('fallo de BD');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  // B1 (Ola 6): alta de usuarios con rol arbitrario, solo accesible para admin
  // (el endpoint POST /auth/usuarios lleva @Roles(admin); aquí se prueba el service).
  describe('crearUsuario', () => {
    const dtoCrear = {
      email: 'conductor@correo.com',
      password: 'Secreta123!',
      nombre: 'Carlos',
      apellido: 'Conductor',
      rolId: 3,
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hash-nuevo');
      queryRunner.manager.create.mockImplementation((entidad: unknown, data: object) => ({
        ...data,
        __entidad: entidad,
      }));
      queryRunner.manager.save.mockImplementation(async (obj: Record<string, unknown>) => {
        if (obj.__entidad === Usuario) obj.id = 'usuario-nuevo';
        if (obj.__entidad === Pasajero) obj.id = 'pasajero-nuevo';
        if (obj.__entidad === WalletPasajero) obj.id = 'wallet-nueva';
        return obj;
      });
    });

    it('lanza BadRequestException si el rolId no existe', async () => {
      rolRepo.findOne.mockResolvedValue(null);

      await expect(service.crearUsuario(dtoCrear)).rejects.toThrow(BadRequestException);
      expect(rolRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      rolRepo.findOne.mockResolvedValue({ id: 3, nombre: 'conductor' });
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });

      await expect(service.crearUsuario(dtoCrear)).rejects.toThrow(ConflictException);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('con rol distinto de pasajero solo crea el usuario (sin pasajero ni wallet)', async () => {
      rolRepo.findOne.mockResolvedValue({ id: 3, nombre: 'conductor' });
      usuarioRepo.findOne.mockResolvedValue(null);

      const resultado = await service.crearUsuario(dtoCrear);

      expect(queryRunner.manager.save).toHaveBeenCalledTimes(1);
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Usuario,
        expect.objectContaining({ email: dtoCrear.email, rolId: 3 }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(resultado.usuarioId).toBe('usuario-nuevo');
    });

    it('con rolId de pasajero también crea pasajero + wallet', async () => {
      rolRepo.findOne.mockResolvedValue({ id: 4, nombre: 'pasajero' });
      usuarioRepo.findOne.mockResolvedValue(null);

      await service.crearUsuario({ ...dtoCrear, rolId: 4 });

      expect(queryRunner.manager.save).toHaveBeenCalledTimes(3);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('refrescar', () => {
    const registroValido = () => ({
      id: 'registro-1',
      usuarioId: usuarioBase.id,
      token: 'hash-guardado',
      revocado: false,
      expiraEn: new Date(Date.now() + 60 * 60 * 1000), // vence en 1h
    });

    it('con token válido rota: revoca el viejo y emite un par nuevo', async () => {
      tokenRefrescoRepo.findOne.mockResolvedValue(registroValido());
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });

      const resultado = await service.refrescar('refresh-token-plano');

      // Rotación: el registro usado queda revocado
      expect(tokenRefrescoRepo.update).toHaveBeenCalledWith('registro-1', { revocado: true });
      // Se emite y persiste un par nuevo
      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(typeof resultado.refreshToken).toBe('string');
      expect(tokenRefrescoRepo.save).toHaveBeenCalledTimes(1);
    });

    it('lanza UnauthorizedException si el token no existe en BD', async () => {
      tokenRefrescoRepo.findOne.mockResolvedValue(null);

      await expect(service.refrescar('token-desconocido')).rejects.toThrow(UnauthorizedException);
      expect(tokenRefrescoRepo.update).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si el token está expirado', async () => {
      tokenRefrescoRepo.findOne.mockResolvedValue({
        ...registroValido(),
        expiraEn: new Date(Date.now() - 1000), // ya venció
      });

      await expect(service.refrescar('token-expirado')).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si el token ya fue revocado', async () => {
      tokenRefrescoRepo.findOne.mockResolvedValue({ ...registroValido(), revocado: true });

      await expect(service.refrescar('token-revocado')).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si el usuario del token está inactivo o no existe', async () => {
      tokenRefrescoRepo.findOne.mockResolvedValue(registroValido());
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(service.refrescar('refresh-token-plano')).rejects.toThrow(UnauthorizedException);
      // No debe rotarse el token si el usuario no es válido
      expect(tokenRefrescoRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('cambiarPassword', () => {
    it('rechaza con BadRequestException si la nueva es igual a la actual', async () => {
      await expect(
        service.cambiarPassword('usuario-1', 'Misma123!', 'Misma123!'),
      ).rejects.toThrow(BadRequestException);

      expect(usuarioRepo.findOne).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si la contraseña actual no valida', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase, debeCambiarPassword: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.cambiarPassword('usuario-1', 'incorrecta', 'Nueva123!segura'),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuarioRepo.update).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('actualiza el hash, limpia el flag, revoca refresh tokens y emite par nuevo sin dcp', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase, debeCambiarPassword: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hash-nuevo');
      usuarioRepo.update.mockResolvedValue(undefined);
      tokenRefrescoRepo.update.mockResolvedValue(undefined);

      const resultado = await service.cambiarPassword('usuario-1', 'Vieja123!', 'Nueva123!segura');

      expect(bcrypt.hash).toHaveBeenCalledWith('Nueva123!segura', 12);
      expect(usuarioRepo.update).toHaveBeenCalledWith('usuario-1', {
        passwordHash: '$2b$12$hash-nuevo',
        debeCambiarPassword: false,
      });
      // Cierre de sesión global: todos los refresh vigentes quedan revocados
      expect(tokenRefrescoRepo.update).toHaveBeenCalledWith(
        { usuarioId: 'usuario-1', revocado: false },
        { revocado: true },
      );
      // El access nuevo NO lleva el claim dcp (flag ya limpio)
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({ dcp: true }),
      );
      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(typeof resultado.refreshToken).toBe('string');
    });

    it('el login de un usuario con flag emite access token con claim dcp', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase, debeCambiarPassword: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usuarioRepo.update.mockResolvedValue(undefined);

      const resultado = await service.login({ email: usuarioBase.email, password: 'Secreta123!' });

      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ dcp: true }));
      expect(resultado.usuario.debeCambiarPassword).toBe(true);
    });
  });

  describe('logout', () => {
    it('revoca todos los refresh tokens vigentes del usuario', async () => {
      tokenRefrescoRepo.update.mockResolvedValue(undefined);

      const resultado = await service.logout('usuario-1');

      expect(tokenRefrescoRepo.update).toHaveBeenCalledWith(
        { usuarioId: 'usuario-1', revocado: false },
        { revocado: true },
      );
      expect(resultado.mensaje).toContain('revocados');
    });
  });
});
