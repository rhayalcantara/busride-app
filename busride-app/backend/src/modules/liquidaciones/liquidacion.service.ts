import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { EstadoLiquidacion } from './entities/liquidacion.entity';

@Injectable()
export class LiquidacionService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

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

  async obtenerMisLiquidaciones(usuarioId: string) {
    const conductorId = await this.resolverConductorId(usuarioId);
    return this.dataSource.query(`
      SELECT l.*, v.fecha_inicio, v.fecha_fin, r.nombre AS ruta_nombre
      FROM liquidaciones l
      LEFT JOIN viajes v ON v.id = l.viaje_id
      LEFT JOIN rutas r  ON r.id = v.ruta_id
      WHERE l.conductor_id = @0
      ORDER BY l.fecha_creacion DESC
    `, [conductorId]);
  }

  async resumenMisLiquidaciones(usuarioId: string, inicio?: string, fin?: string) {
    const conductorId = await this.resolverConductorId(usuarioId);
    return this.dataSource.query(`
      SELECT
        COUNT(*)                    AS total_viajes,
        SUM(total_abordajes)        AS total_pasajeros,
        SUM(ingreso_bruto)          AS ingreso_bruto,
        SUM(comision_plataforma)    AS total_comision_plataforma,
        SUM(comision_asociacion)    AS total_comision_asociacion,
        SUM(monto_neto)             AS total_neto
      FROM liquidaciones
      WHERE conductor_id = @0
        AND (@1 IS NULL OR periodo_inicio >= @1)
        AND (@2 IS NULL OR periodo_fin    <= @2)
    `, [conductorId, inicio ?? null, fin ?? null]);
  }

  async marcarPagada(liquidacionId: string, referenciaPago: string) {
    const [liquidacion] = await this.dataSource.query(
      `SELECT id, estado FROM liquidaciones WHERE id = @0`,
      [liquidacionId],
    );
    if (!liquidacion) {
      throw new NotFoundException('Liquidación no encontrada');
    }
    if (liquidacion.estado === EstadoLiquidacion.PAGADA) {
      throw new BadRequestException('La liquidación ya está marcada como pagada');
    }

    await this.dataSource.query(`
      UPDATE liquidaciones
      SET estado          = @0,
          referencia_pago = @1,
          fecha_pago      = GETDATE()
      WHERE id = @2
    `, [EstadoLiquidacion.PAGADA, referenciaPago, liquidacionId]);

    return {
      mensaje: 'Liquidación marcada como pagada',
      liquidacionId,
      estado: EstadoLiquidacion.PAGADA,
      referenciaPago,
    };
  }
}
