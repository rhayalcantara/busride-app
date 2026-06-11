import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Conductor } from './entities/conductor.entity';
import { Calificacion } from './entities/calificacion.entity';
import { CrearConductorDto } from './dto/crear-conductor.dto';
import { CalificarConductorDto } from './dto/calificar-conductor.dto';
import { RolNombre } from '../../common';

@Injectable()
export class ConductoresService {
  constructor(
    @InjectRepository(Conductor) private conductorRepo: Repository<Conductor>,
    @InjectRepository(Calificacion) private calificacionRepo: Repository<Calificacion>,
    private dataSource: DataSource,
  ) {}

  // Alta de conductor: vincula un usuario existente con rol conductor a una asociación
  async crearConductor(dto: CrearConductorDto) {
    // Validar que el usuario existe, está activo y tiene rol conductor
    const usuarios = await this.dataSource.query(
      `SELECT u.id, u.activo, r.nombre AS rol
       FROM usuarios u
       INNER JOIN roles r ON r.id = u.rol_id
       WHERE u.id = @0`,
      [dto.usuarioId],
    );

    if (usuarios.length === 0) {
      throw new NotFoundException('El usuario indicado no existe');
    }
    if (usuarios[0].rol !== RolNombre.CONDUCTOR) {
      throw new BadRequestException('El usuario indicado no tiene rol conductor');
    }
    if (!usuarios[0].activo) {
      throw new BadRequestException('El usuario indicado está inactivo');
    }

    // Validar que la asociación existe y no está suspendida
    const asociaciones = await this.dataSource.query(
      `SELECT id, estado FROM asociaciones WHERE id = @0`,
      [dto.asociacionId],
    );

    if (asociaciones.length === 0) {
      throw new NotFoundException('La asociación indicada no existe');
    }
    if (asociaciones[0].estado === 'SUSPENDIDA') {
      throw new BadRequestException('La asociación indicada está suspendida');
    }

    // Evitar duplicados: un usuario solo puede tener un registro de conductor
    const existente = await this.conductorRepo.findOne({
      where: { usuarioId: dto.usuarioId },
    });
    if (existente) {
      throw new ConflictException('El usuario ya está registrado como conductor');
    }

    // El número de licencia es UNIQUE en la BD
    const licenciaEnUso = await this.conductorRepo.findOne({
      where: { licenciaNumero: dto.licenciaNumero },
    });
    if (licenciaEnUso) {
      throw new ConflictException('El número de licencia ya está registrado');
    }

    const conductor = this.conductorRepo.create({
      usuarioId: dto.usuarioId,
      asociacionId: dto.asociacionId,
      licenciaNumero: dto.licenciaNumero,
      licenciaVence: new Date(dto.licenciaVence),
      fotoUrl: dto.fotoUrl,
      cuentaBancaria: dto.cuentaBancaria,
      banco: dto.banco,
    });

    const guardado = await this.conductorRepo.save(conductor);

    return {
      mensaje: 'Conductor registrado correctamente',
      conductor: guardado,
    };
  }

  // Perfil del conductor autenticado (resuelto por usuario_id del JWT)
  async obtenerPerfilPorUsuarioId(usuarioId: string) {
    const conductor = await this.conductorRepo.findOne({
      where: { usuarioId },
      relations: ['usuario', 'asociacion'],
    });

    if (!conductor) {
      throw new NotFoundException('No existe un perfil de conductor para el usuario autenticado');
    }

    return {
      id: conductor.id,
      usuarioId: conductor.usuarioId,
      nombre: conductor.usuario?.nombre,
      apellido: conductor.usuario?.apellido,
      email: conductor.usuario?.email,
      telefono: conductor.usuario?.telefono,
      asociacion: conductor.asociacion
        ? { id: conductor.asociacion.id, nombre: conductor.asociacion.nombre }
        : null,
      licenciaNumero: conductor.licenciaNumero,
      licenciaVence: conductor.licenciaVence,
      fotoUrl: conductor.fotoUrl,
      calificacionPromedio: Number(conductor.calificacionPromedio),
      totalViajes: conductor.totalViajes,
      cuentaBancaria: conductor.cuentaBancaria,
      banco: conductor.banco,
      activo: conductor.activo,
      fechaCreacion: conductor.fechaCreacion,
    };
  }

  // Listado de conductores de una asociación
  async listarPorAsociacion(asociacionId: string) {
    const conductores = await this.conductorRepo.find({
      where: { asociacionId },
      relations: ['usuario'],
      order: { fechaCreacion: 'DESC' },
    });

    return conductores.map((c) => ({
      id: c.id,
      usuarioId: c.usuarioId,
      nombre: c.usuario?.nombre,
      apellido: c.usuario?.apellido,
      email: c.usuario?.email,
      licenciaNumero: c.licenciaNumero,
      licenciaVence: c.licenciaVence,
      fotoUrl: c.fotoUrl,
      calificacionPromedio: Number(c.calificacionPromedio),
      totalViajes: c.totalViajes,
      activo: c.activo,
    }));
  }

  // Pasajero califica al conductor por un viaje en el que abordó
  async calificar(conductorId: string, usuarioId: string, dto: CalificarConductorDto) {
    const conductor = await this.conductorRepo.findOne({ where: { id: conductorId } });
    if (!conductor) {
      throw new NotFoundException('El conductor indicado no existe');
    }

    // Resolver pasajero desde el usuario autenticado (identidad del JWT, nunca del body)
    const pasajeros = await this.dataSource.query(
      `SELECT id FROM pasajeros WHERE usuario_id = @0`,
      [usuarioId],
    );
    if (pasajeros.length === 0) {
      throw new NotFoundException('No existe un perfil de pasajero para el usuario autenticado');
    }
    const pasajeroId: string = pasajeros[0].id;

    // Validar que el pasajero abordó ese viaje y que el viaje pertenece a este conductor
    const abordajes = await this.dataSource.query(
      `SELECT TOP 1 a.id
       FROM abordajes a
       WHERE a.pasajero_id = @0 AND a.viaje_id = @1 AND a.conductor_id = @2
       ORDER BY a.fecha_abordaje DESC`,
      [pasajeroId, dto.viajeId, conductorId],
    );
    if (abordajes.length === 0) {
      throw new BadRequestException(
        'No se encontró un abordaje del pasajero en ese viaje con este conductor',
      );
    }
    const abordajeId: string = abordajes[0].id;

    // UNIQUE(abordaje_id) en calificaciones: un abordaje solo se califica una vez
    const yaCalificado = await this.calificacionRepo.findOne({ where: { abordajeId } });
    if (yaCalificado) {
      throw new ConflictException('Ya calificaste este viaje');
    }

    let calificacion: Calificacion;
    try {
      calificacion = await this.calificacionRepo.save(
        this.calificacionRepo.create({
          abordajeId,
          pasajeroId,
          conductorId,
          estrellas: dto.estrellas,
          comentario: dto.comentario,
        }),
      );
    } catch (error: unknown) {
      // Carrera contra el UNIQUE(abordaje_id) en inserciones concurrentes
      const mensaje = error instanceof Error ? error.message : '';
      if (mensaje.includes('UNIQUE') || mensaje.includes('duplicate')) {
        throw new ConflictException('Ya calificaste este viaje');
      }
      throw error;
    }

    // Recalcular el promedio del conductor vía stored procedure
    await this.dataSource.query(
      `EXEC sp_actualizar_calificacion_conductor @conductor_id = @0`,
      [conductorId],
    );

    const actualizado = await this.conductorRepo.findOne({ where: { id: conductorId } });

    return {
      mensaje: 'Calificación registrada correctamente',
      calificacion: {
        id: calificacion.id,
        abordajeId: calificacion.abordajeId,
        conductorId: calificacion.conductorId,
        estrellas: calificacion.estrellas,
        comentario: calificacion.comentario,
      },
      calificacionPromedio: actualizado ? Number(actualizado.calificacionPromedio) : null,
    };
  }
}
