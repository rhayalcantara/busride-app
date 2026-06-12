import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';

// Usuario sin campos sensibles (nunca exponer passwordHash ni tokenVerificacion)
export type UsuarioPublico = Omit<Usuario, 'passwordHash' | 'tokenVerificacion'>;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
  ) {}

  // Perfil del usuario autenticado, con su rol y sin campos sensibles
  async obtenerPerfil(usuarioId: string): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: usuarioId },
      relations: ['rol'],
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    return this.sanitizar(usuario);
  }

  // Actualiza nombre/apellido/telefono del propio usuario
  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
    if (dto.apellido !== undefined) usuario.apellido = dto.apellido;
    if (dto.telefono !== undefined) usuario.telefono = dto.telefono;

    await this.usuarioRepo.save(usuario);

    return this.obtenerPerfil(usuarioId);
  }

  // Cambia la contraseña verificando la actual con bcrypt (hash cost 12)
  async cambiarPassword(usuarioId: string, dto: CambiarPasswordDto): Promise<{ mensaje: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await bcrypt.compare(dto.passwordActual, usuario.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    if (dto.passwordNueva === dto.passwordActual) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const passwordHash = await bcrypt.hash(dto.passwordNueva, 12);
    await this.usuarioRepo.update(usuarioId, { passwordHash });

    return { mensaje: 'Contraseña actualizada correctamente' };
  }

  // Listado paginado de usuarios (solo admin), con filtro opcional por nombre de rol (F-09a)
  async listar(pagina = 1, limite = 20, rol?: string) {
    const [usuarios, total] = await this.usuarioRepo.findAndCount({
      where: rol ? { rol: { nombre: rol } } : undefined,
      relations: ['rol'],
      order: { fechaCreacion: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return {
      datos: usuarios.map((u) => this.sanitizar(u)),
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  // Activa o desactiva un usuario (solo admin)
  async cambiarEstado(usuarioId: string, activo: boolean) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: usuarioId },
      relations: ['rol'],
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    usuario.activo = activo;
    await this.usuarioRepo.save(usuario);

    return {
      mensaje: activo ? 'Usuario activado' : 'Usuario desactivado',
      usuario: this.sanitizar(usuario),
    };
  }

  // Elimina los campos sensibles antes de devolver el usuario en una respuesta
  private sanitizar(usuario: Usuario): UsuarioPublico {
    const { passwordHash: _passwordHash, tokenVerificacion: _tokenVerificacion, ...publico } = usuario;
    return publico;
  }
}
