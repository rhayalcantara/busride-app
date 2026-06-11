import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Viaje, EstadoViaje } from './entities/viaje.entity';

@Injectable()
export class ViajesService {
  constructor(
    @InjectRepository(Viaje) private viajeRepo: Repository<Viaje>,
    private dataSource: DataSource,
  ) {}

  // Resuelve el conductor a partir del usuario autenticado (F4):
  // la identidad SIEMPRE se deriva del JWT, nunca de params/body.
  private async resolverConductorId(usuarioId: string): Promise<string> {
    const [conductor] = await this.dataSource.query(
      `SELECT id FROM conductores WHERE usuario_id = @0`,
      [usuarioId],
    );
    if (!conductor) {
      throw new NotFoundException('No existe un perfil de conductor para este usuario');
    }
    return conductor.id as string;
  }

  // Indica si el usuario autenticado es el conductor del viaje.
  // Usado por el TrackingGateway para autorizar `actualizar_posicion` (F9).
  async esConductorDelViaje(viajeId: string, usuarioId: string): Promise<boolean> {
    const [conductor] = await this.dataSource.query(
      `SELECT id FROM conductores WHERE usuario_id = @0`,
      [usuarioId],
    );
    if (!conductor) return false;

    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    return !!viaje && viaje.conductorId === conductor.id;
  }

  async iniciarViaje(usuarioId: string, asignacionId: string) {
    const conductorId = await this.resolverConductorId(usuarioId);

    // Verificar que no haya otro viaje en curso para este conductor
    const enCurso = await this.viajeRepo.findOne({
      where: { conductorId, estado: EstadoViaje.EN_CURSO },
    });
    if (enCurso) throw new BadRequestException('El conductor ya tiene un viaje en curso');

    // Obtener datos de la asignación, incluido su conductor (B2, Ola 6)
    const [asignacion] = await this.dataSource.query(`
      SELECT a.bus_id, a.ruta_id, a.conductor_id, b.capacidad_total
      FROM asignaciones_bus_ruta a
      INNER JOIN buses b ON b.id = a.bus_id
      WHERE a.id = @0 AND a.activa = 1
    `, [asignacionId]);

    if (!asignacion) throw new BadRequestException('Asignación no encontrada o inactiva');

    // B2 (IDOR, Ola 6): la asignación debe pertenecer al conductor autenticado.
    // Se compara en TS (en vez de filtrar con AND a.conductor_id = @1) para poder
    // distinguir 403 (asignación ajena) de 400 (asignación inexistente/inactiva).
    if (String(asignacion.conductor_id).toLowerCase() !== String(conductorId).toLowerCase()) {
      throw new ForbiddenException('La asignación pertenece a otro conductor');
    }

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

  // Variante HTTP: valida que el viaje pertenezca al conductor autenticado
  // antes de persistir la posición.
  async actualizarPosicionComoConductor(viajeId: string, usuarioId: string, lat: number, lng: number) {
    const conductorId = await this.resolverConductorId(usuarioId);

    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.conductorId !== conductorId) {
      throw new ForbiddenException('El viaje no pertenece al conductor autenticado');
    }

    return this.actualizarPosicion(viajeId, lat, lng);
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

  async finalizarViaje(viajeId: string, usuarioId: string) {
    const conductorId = await this.resolverConductorId(usuarioId);

    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.conductorId !== conductorId) {
      throw new ForbiddenException('El viaje no pertenece al conductor autenticado');
    }
    if (viaje.estado !== EstadoViaje.EN_CURSO) {
      throw new BadRequestException('Solo se puede finalizar un viaje en curso');
    }

    const resultado = await this.dataSource.query(
      `EXEC sp_liquidar_viaje @viaje_id = @0, @conductor_id = @1`,
      [viajeId, conductorId],
    );

    // B5 (Ola 6): si el SP no devuelve filas, error controlado en vez de TypeError/500
    if (!resultado?.length) {
      throw new BadRequestException('El procedimiento de liquidación no devolvió resultado');
    }
    return resultado[0];
  }

  async obtenerMiViajeActivo(usuarioId: string) {
    const conductorId = await this.resolverConductorId(usuarioId);
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

  // Pasajeros con reserva esperando en una parada del viaje (F16:
  // antes el controller accedía a this.viajesService['dataSource']).
  async pasajerosEnParada(viajeId: string, paradaId: number) {
    return this.dataSource.query(
      `EXEC sp_pasajeros_en_parada @viaje_id = @0, @parada_id = @1`,
      [viajeId, paradaId],
    );
  }
}
