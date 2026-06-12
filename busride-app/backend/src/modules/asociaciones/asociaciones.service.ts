import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '../../common';
import { Asociacion } from './entities/asociacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Ruta } from '../rutas/entities/ruta.entity';
import { CrearAsociacionDto } from './dto/crear-asociacion.dto';
import { ActualizarAsociacionDto } from './dto/actualizar-asociacion.dto';

// Estados posibles de una asociación según 02_schema.sql
export const ESTADO_ASOCIACION = {
  PENDIENTE: 'PENDIENTE',
  ACTIVA: 'ACTIVA',
  SUSPENDIDA: 'SUSPENDIDA',
} as const;

export type EstadoAsociacion = (typeof ESTADO_ASOCIACION)[keyof typeof ESTADO_ASOCIACION];

@Injectable()
export class AsociacionesService {
  constructor(
    @InjectRepository(Asociacion)
    private readonly asociacionRepository: Repository<Asociacion>,
  ) {}

  // Crea una asociación en estado PENDIENTE (requiere aprobación posterior)
  async crear(dto: CrearAsociacionDto): Promise<Asociacion> {
    await this.verificarUsuarioExiste(dto.usuarioId);

    if (dto.rnc) {
      const existente = await this.asociacionRepository.findOne({ where: { rnc: dto.rnc } });
      if (existente) {
        // B4 (Ola 6): duplicado → 409, consistente con el resto del backend
        throw new ConflictException(`Ya existe una asociación con el RNC ${dto.rnc}`);
      }
    }

    const asociacion = this.asociacionRepository.create({
      ...dto,
      estado: ESTADO_ASOCIACION.PENDIENTE,
    });

    return this.asociacionRepository.save(asociacion);
  }

  // Listado público: solo asociaciones activas
  async listarActivas(): Promise<Asociacion[]> {
    return this.asociacionRepository.find({
      where: { estado: ESTADO_ASOCIACION.ACTIVA },
      order: { nombre: 'ASC' },
    });
  }

  // F-09a: sin estado se mantiene el comportamiento original (solo ACTIVAS,
  // cualquier usuario autenticado); el filtro por estado es exclusivo del admin.
  async listar(rolUsuario: string, estado?: EstadoAsociacion): Promise<Asociacion[]> {
    if (estado === undefined) {
      return this.listarActivas();
    }
    if (rolUsuario !== RolNombre.ADMIN) {
      throw new ForbiddenException('Solo un administrador puede filtrar asociaciones por estado');
    }
    return this.asociacionRepository.find({
      where: { estado },
      order: { nombre: 'ASC' },
    });
  }

  // F-09a: asociación vinculada al usuario autenticado (rol asociacion)
  async obtenerMia(usuarioId: string): Promise<Asociacion> {
    const asociacion = await this.asociacionRepository.findOne({ where: { usuarioId } });
    if (!asociacion) {
      throw new NotFoundException(
        'Tu usuario no tiene una asociación vinculada. Contacta al administrador.',
      );
    }
    return asociacion;
  }

  // Detalle de una asociación con sus rutas
  async obtenerConRutas(id: string): Promise<Asociacion & { rutas: Ruta[] }> {
    const asociacion = await this.obtenerPorId(id);

    // La entidad Asociacion no declara la relación inversa con rutas,
    // así que se consultan por FK a través del entity manager
    const rutas = await this.asociacionRepository.manager.find(Ruta, {
      where: { asociacionId: id },
      order: { nombre: 'ASC' },
    });

    return { ...asociacion, rutas };
  }

  // Actualiza los datos generales de la asociación
  async actualizar(id: string, dto: ActualizarAsociacionDto): Promise<Asociacion> {
    const asociacion = await this.obtenerPorId(id);

    if (dto.rnc && dto.rnc !== asociacion.rnc) {
      const existente = await this.asociacionRepository.findOne({ where: { rnc: dto.rnc } });
      if (existente && existente.id !== id) {
        // B4 (Ola 6): duplicado → 409, consistente con el resto del backend
        throw new ConflictException(`Ya existe una asociación con el RNC ${dto.rnc}`);
      }
    }

    Object.assign(asociacion, dto);
    return this.asociacionRepository.save(asociacion);
  }

  // Aprueba la asociación: la activa y registra qué admin la aprobó
  async aprobar(id: string, adminUserId: string): Promise<Asociacion> {
    const asociacion = await this.obtenerPorId(id);

    if (asociacion.estado === ESTADO_ASOCIACION.ACTIVA) {
      throw new BadRequestException('La asociación ya está activa');
    }

    asociacion.estado = ESTADO_ASOCIACION.ACTIVA;
    asociacion.aprobadoPor = adminUserId;
    asociacion.fechaAprobacion = new Date();

    return this.asociacionRepository.save(asociacion);
  }

  // Vincula (o reemplaza) el usuario administrador de la asociación (FK usuario_id)
  async vincularUsuarioAdmin(id: string, usuarioId: string): Promise<Asociacion> {
    const asociacion = await this.obtenerPorId(id);
    await this.verificarUsuarioExiste(usuarioId);

    asociacion.usuarioId = usuarioId;
    return this.asociacionRepository.save(asociacion);
  }

  private async obtenerPorId(id: string): Promise<Asociacion> {
    const asociacion = await this.asociacionRepository.findOne({ where: { id } });
    if (!asociacion) {
      throw new NotFoundException('Asociación no encontrada');
    }
    return asociacion;
  }

  private async verificarUsuarioExiste(usuarioId: string): Promise<void> {
    const usuario = await this.asociacionRepository.manager.findOne(Usuario, {
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`No existe un usuario con id ${usuarioId}`);
    }
  }
}
