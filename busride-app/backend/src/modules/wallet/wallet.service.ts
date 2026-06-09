import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletPasajero } from './entities/wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletPasajero) private walletRepo: Repository<WalletPasajero>,
    private dataSource: DataSource,
  ) {}

  async obtenerSaldo(pasajeroId: string) {
    const wallet = await this.walletRepo.findOne({ where: { pasajeroId } });
    if (!wallet) throw new NotFoundException('Wallet no encontrada');
    return wallet;
  }

  async comprarPaquete(pasajeroId: string, paqueteId: number, referenciaExternal: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [paquete] = await queryRunner.query(
        `SELECT * FROM paquetes_viaje WHERE id = @0 AND activo = 1`,
        [paqueteId],
      );
      if (!paquete) throw new BadRequestException('Paquete no disponible');

      const totalViajes = paquete.cantidad_viajes + paquete.viajes_bono;

      // Registrar transacción de compra
      await queryRunner.query(`
        INSERT INTO transacciones (pasajero_id, tipo, monto, viajes_cantidad, referencia_externa, estado, descripcion)
        VALUES (@0, 'RECARGA', @1, @2, @3, 'COMPLETADA', @4)
      `, [
        pasajeroId, paquete.precio, totalViajes,
        referenciaExternal, `Compra paquete: ${paquete.nombre}`,
      ]);

      // Acreditar viajes al wallet
      await queryRunner.query(`
        UPDATE wallet_pasajeros
        SET saldo_viajes = saldo_viajes + @0,
            fecha_actualizacion = GETDATE()
        WHERE pasajero_id = @1
      `, [totalViajes, pasajeroId]);

      await queryRunner.commitTransaction();

      return {
        viajesAcreditados: totalViajes,
        paquete:           paquete.nombre,
        precio:            paquete.precio,
        nuevaSaldo:        await this.obtenerSaldo(pasajeroId),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async listarPaquetes() {
    return this.dataSource.query(
      `SELECT * FROM paquetes_viaje WHERE activo = 1 ORDER BY cantidad_viajes ASC`,
    );
  }

  async historialTransacciones(pasajeroId: string, limite = 20) {
    return this.dataSource.query(`
      SELECT TOP (@0) *
      FROM transacciones
      WHERE pasajero_id = @1
      ORDER BY fecha_creacion DESC
    `, [limite, pasajeroId]);
  }
}
