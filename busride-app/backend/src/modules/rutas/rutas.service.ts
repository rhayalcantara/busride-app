import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ruta } from './entities/ruta.entity';
import { Parada } from './entities/parada.entity';

export interface BuscarRutasDto {
  latOrigen: number;
  lngOrigen: number;
  latDestino: number;
  lngDestino: number;
  radioMetros?: number;
}

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Ruta) private rutaRepo: Repository<Ruta>,
    @InjectRepository(Parada) private paradaRepo: Repository<Parada>,
    private dataSource: DataSource,
  ) {}

  async buscarRutasDisponibles(dto: BuscarRutasDto) {
    const radio = dto.radioMetros || 500;

    // Llama al stored procedure geoespacial
    const resultado = await this.dataSource.query(
      `EXEC sp_buscar_rutas_disponibles
        @lat_origen   = @0,
        @lng_origen   = @1,
        @lat_destino  = @2,
        @lng_destino  = @3,
        @radio_metros = @4`,
      [dto.latOrigen, dto.lngOrigen, dto.latDestino, dto.lngDestino, radio],
    );

    return resultado;
  }

  async crearRuta(asociacionId: string, data: Partial<Ruta> & { paradas: Partial<Parada>[] }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ruta = this.rutaRepo.create({ ...data, asociacionId });
      const rutaGuardada = await queryRunner.manager.save(Ruta, ruta);

      // Insertar paradas con columna geography via raw SQL
      for (const parada of data.paradas) {
        await queryRunner.query(`
          INSERT INTO paradas (ruta_id, nombre, orden, ubicacion, referencia, es_terminal)
          VALUES (@0, @1, @2, geography::Point(@3, @4, 4326), @5, @6)
        `, [
          rutaGuardada.id, parada.nombre, parada.orden,
          parada.lat, parada.lng, parada.referencia ?? null, parada.esTerminal ?? false,
        ]);
      }

      // Actualizar polyline de la ruta si se provee WKT
      if (data.polylineWkt) {
        await queryRunner.query(`
          UPDATE rutas
          SET polyline = geography::STGeomFromText(@0, 4326)
          WHERE id = @1
        `, [data.polylineWkt, rutaGuardada.id]);
      }

      await queryRunner.commitTransaction();
      return rutaGuardada;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async listarRutasPorAsociacion(asociacionId: string) {
    return this.rutaRepo.find({
      where: { asociacionId, activa: true },
      relations: ['paradas'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  async obtenerRuta(id: string) {
    const ruta = await this.rutaRepo.findOne({
      where: { id },
      relations: ['paradas', 'asociacion'],
    });
    if (!ruta) throw new NotFoundException('Ruta no encontrada');
    return ruta;
  }

  async obtenerParadasConUbicacion(rutaId: string) {
    // Extrae lat/lng desde la columna geography
    return this.dataSource.query(`
      SELECT id, nombre, orden, referencia, es_terminal,
             ubicacion.Lat  AS lat,
             ubicacion.Long AS lng
      FROM paradas
      WHERE ruta_id = @0
      ORDER BY orden ASC
    `, [rutaId]);
  }
}
