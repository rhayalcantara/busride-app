import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Pasajero } from '../wallet/entities/pasajero.entity';
import { WalletPasajero } from '../wallet/entities/wallet.entity';
import { TokenRefresco } from './entities/token-refresco.entity';
import { RolNombre } from '../../common';
import { RegistrarDto } from './dto/registrar.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    @InjectRepository(Rol) private rolRepo: Repository<Rol>,
    @InjectRepository(TokenRefresco) private tokenRefrescoRepo: Repository<TokenRefresco>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Días de vida del refresh token (configurable vía REFRESH_TOKEN_DIAS)
  private get diasRefresh(): number {
    return this.configService.get<number>('REFRESH_TOKEN_DIAS', 7);
  }

  // Registro PÚBLICO (B1, Ola 6): siempre crea un PASAJERO. El rol ya no viene
  // del cliente — se resuelve por nombre desde la tabla roles. Los roles
  // privilegiados (admin/asociacion/conductor) solo se crean vía crearUsuario()
  // (endpoint POST /auth/usuarios, restringido a admin).
  async registrar(dto: RegistrarDto) {
    const rol = await this.rolRepo.findOne({ where: { nombre: RolNombre.PASAJERO } });
    if (!rol) {
      // Seed de roles ausente: error de configuración del servidor, no del cliente
      throw new InternalServerErrorException('El rol pasajero no está configurado');
    }
    return this.crearUsuarioConRol(dto, rol);
  }

  // Alta de usuarios con rol arbitrario — SOLO admin (B1, Ola 6).
  async crearUsuario(dto: CrearUsuarioDto) {
    const rol = await this.rolRepo.findOne({ where: { id: dto.rolId } });
    if (!rol) throw new BadRequestException('El rol indicado no existe');
    return this.crearUsuarioConRol(dto, rol);
  }

  private async crearUsuarioConRol(dto: RegistrarDto, rol: Rol) {
    const existe = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (existe) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Registro transaccional (F8): si el rol es pasajero, se crean en la misma
    // transacción su fila en `pasajeros` y su wallet en `wallet_pasajeros` (saldo 0).
    // Para rol conductor NO se crea fila en `conductores`: requiere datos de
    // licencia y lo gestiona el módulo de conductores (Ola 3).
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const usuario = queryRunner.manager.create(Usuario, {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rolId: rol.id,
      });
      await queryRunner.manager.save(usuario);

      if (rol.nombre === RolNombre.PASAJERO) {
        const pasajero = queryRunner.manager.create(Pasajero, { usuarioId: usuario.id });
        await queryRunner.manager.save(pasajero);

        const wallet = queryRunner.manager.create(WalletPasajero, {
          pasajeroId: pasajero.id,
          saldoViajes: 0,
          saldoDinero: 0,
        });
        await queryRunner.manager.save(wallet);
      }

      await queryRunner.commitTransaction();

      return {
        mensaje: 'Usuario registrado. Verifica tu email para activar la cuenta.',
        usuarioId: usuario.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: { email: dto.email, activo: true },
      relations: ['rol'],
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValida) throw new UnauthorizedException('Credenciales inválidas');

    await this.usuarioRepo.update(usuario.id, { ultimoLogin: new Date() });

    const { accessToken, refreshToken } = await this.emitirTokens(usuario);

    return {
      accessToken,
      refreshToken,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        email:    usuario.email,
        rol:      usuario.rol?.nombre,
      },
    };
  }

  // Valida el refresh token recibido, lo ROTA (revoca el usado) y emite un par nuevo.
  async refrescar(refreshToken: string) {
    const hash = this.hashearToken(refreshToken);

    const registro = await this.tokenRefrescoRepo.findOne({ where: { token: hash } });

    if (!registro || registro.revocado || registro.expiraEn.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: registro.usuarioId, activo: true },
      relations: ['rol'],
    });
    if (!usuario) throw new UnauthorizedException('Usuario inactivo o inexistente');

    // Rotación: el token usado queda revocado antes de emitir el nuevo par
    await this.tokenRefrescoRepo.update(registro.id, { revocado: true });

    return this.emitirTokens(usuario);
  }

  // Revoca todos los refresh tokens vigentes del usuario (cierre de sesión global)
  async logout(usuarioId: string) {
    await this.tokenRefrescoRepo.update(
      { usuarioId, revocado: false },
      { revocado: true },
    );
    return { mensaje: 'Sesión cerrada. Refresh tokens revocados.' };
  }

  // Emite access token (JWT) + refresh token (string aleatorio opaco, NO JWT).
  // En BD solo se persiste el hash sha256 del refresh token.
  private async emitirTokens(usuario: Usuario) {
    const payload = { sub: usuario.id, email: usuario.email, rol: usuario.rol?.nombre };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const expiraEn = new Date(Date.now() + this.diasRefresh * 24 * 60 * 60 * 1000);

    await this.tokenRefrescoRepo.save(
      this.tokenRefrescoRepo.create({
        usuarioId: usuario.id,
        token: this.hashearToken(refreshToken),
        expiraEn,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashearToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
