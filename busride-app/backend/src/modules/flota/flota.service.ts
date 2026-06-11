import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Bus } from '../buses/entities/bus.entity';
import { Horario } from '../buses/entities/horario.entity';
import { AsignacionBusRuta } from '../buses/entities/asignacion-bus-ruta.entity';
import { CrearBusDto } from './dto/crear-bus.dto';
import { ActualizarBusDto } from './dto/actualizar-bus.dto';
import { CrearHorarioDto } from './dto/crear-horario.dto';
import { CrearAsignacionDto } from './dto/crear-asignacion.dto';

@Injectable()
export class FlotaService {
  constructor(
    @InjectRepository(Bus) private busRepo: Repository<Bus>,
    @InjectRepository(Horario) private horarioRepo: Repository<Horario>,
    @InjectRepository(AsignacionBusRuta)
    private asignacionRepo: Repository<AsignacionBusRuta>,
    private dataSource: DataSource,
  ) {}

  // ============================================================
  // Buses
  // ============================================================

  async crearBus(dto: CrearBusDto): Promise<Bus> {
    const placa = dto.placa.trim().toUpperCase();

    const existente = await this.busRepo.findOne({ where: { placa } });
    if (existente) {
      throw new ConflictException(`Ya existe un bus registrado con la placa ${placa}`);
    }

    // T-12: asociaciones no tiene columna `activa`; su vigencia es estado = 'ACTIVA'
    const asociacion = await this.dataSource.query(
      `SELECT id FROM asociaciones WHERE id = @0 AND estado = 'ACTIVA'`,
      [dto.asociacionId],
    );
    if (!asociacion.length) {
      throw new NotFoundException('La asociación no existe o está inactiva');
    }

    const bus = this.busRepo.create({ ...dto, placa });
    return this.busRepo.save(bus);
  }

  async listarBusesPorAsociacion(asociacionId: string): Promise<Bus[]> {
    return this.busRepo.find({
      where: { asociacionId },
      order: { placa: 'ASC' },
    });
  }

  async actualizarBus(id: string, dto: ActualizarBusDto): Promise<Bus> {
    const bus = await this.busRepo.findOne({ where: { id } });
    if (!bus) throw new NotFoundException('Bus no encontrado');

    if (dto.placa) {
      const placa = dto.placa.trim().toUpperCase();
      const duplicado = await this.busRepo.findOne({ where: { placa } });
      if (duplicado && duplicado.id !== id) {
        throw new ConflictException(`Ya existe otro bus con la placa ${placa}`);
      }
      dto.placa = placa;
    }

    Object.assign(bus, dto);
    return this.busRepo.save(bus);
  }

  // ============================================================
  // Horarios
  // ============================================================

  async crearHorario(dto: CrearHorarioDto): Promise<Horario> {
    if (dto.horaInicio >= dto.horaFin) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    const ruta = await this.dataSource.query(
      'SELECT id FROM rutas WHERE id = @0 AND activa = 1',
      [dto.rutaId],
    );
    if (!ruta.length) {
      throw new NotFoundException('La ruta no existe o está inactiva');
    }

    const horario = this.horarioRepo.create({
      rutaId: dto.rutaId,
      diasSemana: dto.diasSemana,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      frecuenciaMin: dto.frecuenciaMin ?? 30,
    });
    return this.horarioRepo.save(horario);
  }

  async listarHorariosPorRuta(rutaId: string): Promise<Horario[]> {
    return this.horarioRepo.find({
      where: { rutaId },
      order: { horaInicio: 'ASC' },
    });
  }

  // ============================================================
  // Asignaciones bus-ruta-conductor
  // ============================================================

  async crearAsignacion(dto: CrearAsignacionDto): Promise<AsignacionBusRuta> {
    // El bus debe existir y estar activo
    const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
    if (!bus) throw new NotFoundException('Bus no encontrado');
    if (!bus.activo) throw new BadRequestException('El bus está desactivado');

    // La ruta debe existir y estar activa
    const ruta = await this.dataSource.query(
      'SELECT id FROM rutas WHERE id = @0 AND activa = 1',
      [dto.rutaId],
    );
    if (!ruta.length) {
      throw new NotFoundException('La ruta no existe o está inactiva');
    }

    // El conductor debe existir y estar activo
    const conductor = await this.dataSource.query(
      'SELECT id FROM conductores WHERE id = @0 AND activo = 1',
      [dto.conductorId],
    );
    if (!conductor.length) {
      throw new NotFoundException('El conductor no existe o está inactivo');
    }

    // El bus no puede tener otra asignación activa
    const busOcupado = await this.asignacionRepo.findOne({
      where: { busId: dto.busId, activa: true },
    });
    if (busOcupado) {
      throw new ConflictException('El bus ya tiene una asignación activa');
    }

    // El conductor tampoco puede tener otra asignación activa
    const conductorOcupado = await this.asignacionRepo.findOne({
      where: { conductorId: dto.conductorId, activa: true },
    });
    if (conductorOcupado) {
      throw new ConflictException('El conductor ya tiene una asignación activa');
    }

    const asignacion = this.asignacionRepo.create({
      busId: dto.busId,
      rutaId: dto.rutaId,
      conductorId: dto.conductorId,
      activa: true,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : new Date(),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
    });
    return this.asignacionRepo.save(asignacion);
  }

  async desactivarAsignacion(id: string): Promise<AsignacionBusRuta> {
    const asignacion = await this.asignacionRepo.findOne({ where: { id } });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');

    if (!asignacion.activa) {
      throw new BadRequestException('La asignación ya está desactivada');
    }

    asignacion.activa = false;
    asignacion.fechaFin = new Date();
    return this.asignacionRepo.save(asignacion);
  }

  async listarAsignacionesActivasPorConductor(conductorId: string): Promise<AsignacionBusRuta[]> {
    return this.asignacionRepo.find({
      where: { conductorId, activa: true },
      relations: ['bus', 'ruta'],
      order: { fechaInicio: 'DESC' },
    });
  }

  // B6 (Ola 6): asignaciones del conductor AUTENTICADO — la identidad se deriva
  // del JWT (usuario → conductor), nunca de un param (consistente con F4).
  async listarMisAsignaciones(usuarioId: string): Promise<AsignacionBusRuta[]> {
    const [conductor] = await this.dataSource.query(
      'SELECT id FROM conductores WHERE usuario_id = @0',
      [usuarioId],
    );
    if (!conductor) {
      throw new NotFoundException('No existe un perfil de conductor para este usuario');
    }
    return this.listarAsignacionesActivasPorConductor(conductor.id);
  }
}
