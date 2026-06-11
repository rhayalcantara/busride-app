import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsuariosService', () => {
  let service: UsuariosService;

  const usuarioRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findAndCount: jest.fn(),
  };

  const usuarioBase = {
    id: 'usuario-1',
    email: 'juan@correo.com',
    passwordHash: '$2b$12$hash-almacenado',
    tokenVerificacion: 'token-secreto',
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: null,
    activo: true,
    rol: { id: 4, nombre: 'pasajero' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('obtenerPerfil', () => {
    it('devuelve el perfil sanitizado: nunca passwordHash ni tokenVerificacion', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });

      const perfil = await service.obtenerPerfil('usuario-1');

      expect(perfil).not.toHaveProperty('passwordHash');
      expect(perfil).not.toHaveProperty('tokenVerificacion');
      expect(perfil).toMatchObject({
        id: 'usuario-1',
        email: 'juan@correo.com',
        nombre: 'Juan',
      });
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(service.obtenerPerfil('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizarPerfil', () => {
    it('actualiza solo los campos enviados y devuelve el perfil sin campos sensibles', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      usuarioRepo.save.mockResolvedValue(undefined);

      const resultado = await service.actualizarPerfil('usuario-1', { nombre: 'Juana' });

      expect(usuarioRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Juana', apellido: 'Pérez' }),
      );
      expect(resultado).not.toHaveProperty('passwordHash');
    });
  });

  describe('cambiarPassword', () => {
    const dto = { passwordActual: 'Actual123!', passwordNueva: 'Nueva456!' };

    it('lanza UnauthorizedException si la contraseña actual es incorrecta', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.cambiarPassword('usuario-1', dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usuarioRepo.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la nueva contraseña es igual a la actual', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.cambiarPassword('usuario-1', {
          passwordActual: 'Actual123!',
          passwordNueva: 'Actual123!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(usuarioRepo.update).not.toHaveBeenCalled();
    });

    it('con datos válidos genera hash bcrypt (cost 12) de la nueva y la persiste', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hash-nuevo');

      const resultado = await service.cambiarPassword('usuario-1', dto);

      expect(bcrypt.compare).toHaveBeenCalledWith(dto.passwordActual, usuarioBase.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.passwordNueva, 12);
      expect(usuarioRepo.update).toHaveBeenCalledWith('usuario-1', {
        passwordHash: '$2b$12$hash-nuevo',
      });
      expect(resultado.mensaje).toContain('actualizada');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(service.cambiarPassword('inexistente', dto)).rejects.toThrow(NotFoundException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('calcula totalPaginas con Math.ceil y aplica skip/take según página y límite', async () => {
      usuarioRepo.findAndCount.mockResolvedValue([[{ ...usuarioBase }], 45]);

      const resultado = await service.listar(2, 10);

      expect(usuarioRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(resultado.total).toBe(45);
      expect(resultado.pagina).toBe(2);
      expect(resultado.limite).toBe(10);
      expect(resultado.totalPaginas).toBe(5); // ceil(45/10)
    });

    it('usa valores por defecto (pagina=1, limite=20) y sanitiza los usuarios devueltos', async () => {
      usuarioRepo.findAndCount.mockResolvedValue([[{ ...usuarioBase }], 1]);

      const resultado = await service.listar();

      expect(usuarioRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(resultado.totalPaginas).toBe(1);
      expect(resultado.datos[0]).not.toHaveProperty('passwordHash');
      expect(resultado.datos[0]).not.toHaveProperty('tokenVerificacion');
    });
  });

  describe('cambiarEstado', () => {
    it('desactiva al usuario y devuelve mensaje + usuario sanitizado', async () => {
      usuarioRepo.findOne.mockResolvedValue({ ...usuarioBase });
      usuarioRepo.save.mockResolvedValue(undefined);

      const resultado = await service.cambiarEstado('usuario-1', false);

      expect(usuarioRepo.save).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
      expect(resultado.mensaje).toBe('Usuario desactivado');
      expect(resultado.usuario).not.toHaveProperty('passwordHash');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(service.cambiarEstado('inexistente', true)).rejects.toThrow(NotFoundException);
    });
  });

  // El límite máximo del listado lo impone el DTO (Max(100)) validado por el
  // ValidationPipe global; se verifica aquí la regla de validación.
  describe('ListarUsuariosDto (límite máximo)', () => {
    it('rechaza un límite mayor a 100', async () => {
      const dto = plainToInstance(ListarUsuariosDto, { limite: '500' });

      const errores = await validate(dto);

      expect(errores.length).toBeGreaterThan(0);
      expect(errores[0].constraints).toHaveProperty('max');
    });

    it('acepta límite 100 y aplica defaults (pagina=1, limite=20) cuando no se envían', async () => {
      const valido = plainToInstance(ListarUsuariosDto, { limite: '100' });
      const vacio = plainToInstance(ListarUsuariosDto, {});

      expect(await validate(valido)).toHaveLength(0);
      expect(valido.limite).toBe(100);
      expect(vacio.pagina).toBe(1);
      expect(vacio.limite).toBe(20);
    });
  });
});
