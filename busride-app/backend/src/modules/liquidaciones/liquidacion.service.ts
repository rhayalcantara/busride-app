import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class LiquidacionService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async obtenerLiquidacionesConductor(conductorId: string) {
    return this.dataSource.query(`
      SELECT l.*, v.fecha_inicio, v.fecha_fin, r.nombre AS ruta_nombre
      FROM liquidaciones l
      LEFT JOIN viajes v ON v.id = l.viaje_id
      LEFT JOIN rutas r  ON r.id = v.ruta_id
      WHERE l.conductor_id = @0
      ORDER BY l.fecha_creacion DESC
    `, [conductorId]);
  }

  async resumenLiquidacionPeriodo(conductorId: string, inicio: string, fin: string) {
    return this.dataSource.query(`
      SELECT
        COUNT(*)                    AS total_viajes,
        SUM(total_abordajes)        AS total_pasajeros,
        SUM(ingreso_bruto)          AS ingreso_bruto,
        SUM(comision_plataforma)    AS total_comision_plataforma,
        SUM(comision_asociacion)    AS total_comision_asociacion,
        SUM(monto_neto)             AS total_neto
      FROM liquidaciones
      WHERE conductor_id  = @0
        AND periodo_inicio >= @1
        AND periodo_fin    <= @2
    `, [conductorId, inicio, fin]);
  }

  async marcarPagada(liquidacionId: string, referenciaPago: string) {
    return this.dataSource.query(`
      UPDATE liquidaciones
      SET estado          = 'PAGADA',
          referencia_pago = @0,
          fecha_pago      = GETDATE()
      WHERE id = @1
    `, [referenciaPago, liquidacionId]);
  }
}
