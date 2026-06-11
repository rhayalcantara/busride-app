import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ruta } from './entities/ruta.entity';
import { Parada } from './entities/parada.entity';
import { RolNombre, UsuarioAutenticado } from '../../common';
import { BuscarRutasDto } from './dto/buscar-rutas.dto';
import { CrearRutaDto } from './dto/crear-ruta.dto';

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Ruta) private rutaRepo: Repository<Ruta>,
    @InjectRepository(Parada) private paradaRepo: Repository<Parada>,
    private dataSource: DataSource,
  ) {}

  // Resuelve la asociación dueña de la ruta (F4): para rol asociacion se deriva
  // del JWT (usuario administrador de la asociación); el admin debe indicarla.
  private async resolverAsociacionId(user: UsuarioAutenticado, dto: CrearRutaDto): Promise<string> {
    if (user.rol === RolNombre.ASOCIACION) {
      const [asociacion] = await this.dataSource.query(
        `SELECT id FROM asociaciones WHERE usuario_id = @0`,
        [user.userId],
      );
      if (!asociacion) {
        throw new NotFoundException('Tu usuario no administra ninguna asociación');
      }
      return asociacion.id;
    }

    // Rol admin: la asociación viene en el DTO y debe existir
    if (!dto.asociacionId) {
      throw new BadRequestException('asociacionId es obligatorio para rol admin');
    }
    const [existe] = await this.dataSource.query(
      `SELECT id FROM asociaciones WHERE id = @0`,
      [dto.asociacionId],
    );
    if (!existe) throw new NotFoundException('Asociación no encontrada');
    return dto.asociacionId;
  }

  async crearRutaComoUsuario(user: UsuarioAutenticado, dto: CrearRutaDto) {
    const asociacionId = await this.resolverAsociacionId(user, dto);
    return this.crearRuta(asociacionId, dto);
  }

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

  async crearRuta(asociacionId: string, data: CrearRutaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // T-12: paradas y polylineWkt NO se persisten vía entidad (las paradas se
      // insertan abajo con SQL crudo por la columna geography; el cascade del
      // relation fallaría porque `ubicacion` es NOT NULL).
      const { paradas: _paradas, polylineWkt: _wkt, ...datosRuta } = data;
      const ruta = this.rutaRepo.create({ ...datosRuta, asociacionId });
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
