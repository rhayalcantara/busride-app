import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Viaje, EstadoViaje } from './entities/viaje.entity';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viaje) private viajeRepo: Repository<Viaje>,
    private dataSource: DataSource,
  ) {}

  async iniciarViaje(conductorId: string, asignacionId: string) {
    // Verificar que no haya otro viaje en curso para este conductor
    const enCurso = await this.viajeRepo.findOne({
      where: { conductorId, estado: EstadoViaje.EN_CURSO },
    });
    if (enCurso) throw new BadRequestException('El conductor ya tiene un viaje en curso');

    // Obtener datos de la asignación
    const [asignacion] = await this.dataSource.query(`
      SELECT a.bus_id, a.ruta_id, b.capacidad_total
      FROM asignaciones_bus_ruta a
      INNER JOIN buses b ON b.id = a.bus_id
      WHERE a.id = @0 AND a.activa = 1
    `, [asignacionId]);

    if (!asignacion) throw new BadRequestException('Asignación no encontrada o inactiva');

    const viaje = this.viajeRepo.create({
      conductorId,
      asignacionId,
      busId:               asignacion.bus_id,
      rutaId:              asignacion.ruta_id,
      estado:              EstadoViaje.EN_CURSO,
      asientosDisponibles: asignacion.capacidad_total,
      fechaInicio:         new Date(),
    });

    return this.viajeRepo.save(viaje);
  }

  async actualizarPosicion(viajeId: string, lat: number, lng: number) {
    // Actualizar la columna geography de posición actual y campos lat/lng
    await this.dataSource.query(`
      UPDATE viajes
      SET posicion_actual = geography::Point(@0, @1, 4326),
          pos_lat         = @0,
          pos_lng         = @1,
          fecha_posicion  = GETDATE()
      WHERE id = @2 AND estado = 'EN_CURSO'
    `, [lat, lng, viajeId]);

    return { viajeId, lat, lng, timestamp: new Date() };
  }

  async finalizarViaje(viajeId: string, conductorId: string) {
    const resultado = await this.dataSource.query(
      `EXEC sp_liquidar_viaje @viaje_id = @0, @conductor_id = @1`,
      [viajeId, conductorId],
    );
    return resultado[0];
  }

  async obtenerViajeActivo(conductorId: string) {
    return this.viajeRepo.findOne({
      where: { conductorId, estado: EstadoViaje.EN_CURSO },
      relations: ['ruta', 'ruta.paradas'],
    });
  }

  async obtenerViajePorId(id: string) {
    return this.viajeRepo.findOne({
      where: { id },
      relations: ['ruta', 'conductor', 'conductor.usuario'],
    });
  }
}
