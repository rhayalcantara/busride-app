import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  async registrar(email: string, password: string, nombre: string, apellido: string, rolId: number) {
    const existe = await this.usuarioRepo.findOne({ where: { email } });
    if (existe) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = this.usuarioRepo.create({ email, passwordHash, nombre, apellido, rolId });
    await this.usuarioRepo.save(usuario);

    return { mensaje: 'Usuario registrado. Verifica tu email para activar la cuenta.' };
  }

  async login(email: string, password: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { email, activo: true },
      relations: ['rol'],
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) throw new UnauthorizedException('Credenciales inválidas');

    await this.usuarioRepo.update(usuario.id, { ultimoLogin: new Date() });

    const payload = { sub: usuario.id, email: usuario.email, rol: usuario.rol?.nombre };
    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id:      usuario.id,
        nombre:  usuario.nombre,
        apellido: usuario.apellido,
        email:   usuario.email,
        rol:     usuario.rol?.nombre,
      },
    };
  }
}
