import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletPasajero } from './entities/wallet.entity';
import { Pasajero } from './entities/pasajero.entity';
import { TipoTransaccion, EstadoTransaccion } from './entities/transaccion.entity';
import { ComprarPaqueteDto } from './dto/comprar-paquete.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletPasajero) private walletRepo: Repository<WalletPasajero>,
    @InjectRepository(Pasajero) private pasajeroRepo: Repository<Pasajero>,
    private dataSource: DataSource,
  ) {}

  // Resuelve el pasajero a partir del usuario autenticado (identidad del JWT — F4).
  // Nunca se acepta un pasajeroId desde params o body.
  private async obtenerPasajeroId(userId: string): Promise<string> {
    const pasajero = await this.pasajeroRepo.findOne({ where: { usuarioId: userId } });
    if (!pasajero) {
      throw new NotFoundException('No existe un perfil de pasajero para este usuario');
    }
    return pasajero.id;
  }

  async obtenerMiSaldo(userId: string) {
    const pasajeroId = await this.obtenerPasajeroId(userId);
    const wallet = await this.walletRepo.findOne({ where: { pasajeroId } });
    if (!wallet) throw new NotFoundException('Wallet no encontrada para el pasajero');
    return wallet;
  }

  async comprarPaquete(userId: string, dto: ComprarPaqueteDto) {
    const pasajeroId = await this.obtenerPasajeroId(userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Idempotencia (F10): si ya existe una transacción COMPLETADA con esta
      // referencia externa para el mismo pasajero, se devuelve la compra original
      // sin volver a acreditar. UPDLOCK + HOLDLOCK serializa compras concurrentes
      // con la misma referencia dentro de la transacción.
      const [existente] = await queryRunner.query(
        `SELECT TOP 1 id, monto, viajes_cantidad, descripcion, fecha_creacion
         FROM transacciones WITH (UPDLOCK, HOLDLOCK)
         WHERE pasajero_id = @0
           AND referencia_externa = @1
           AND tipo = @2
           AND estado = @3`,
        [pasajeroId, dto.referenciaExterna, TipoTransaccion.RECARGA, EstadoTransaccion.COMPLETADA],
      );

      if (existente) {
        await queryRunner.commitTransaction();
        return {
          idempotente: true,
          mensaje: 'Esta referencia externa ya fue procesada; no se acreditaron viajes nuevamente',
          transaccionId: existente.id,
          viajesAcreditados: existente.viajes_cantidad,
          precio: existente.monto,
          descripcion: existente.descripcion,
          fechaCreacion: existente.fecha_creacion,
        };
      }

      const [paquete] = await queryRunner.query(
        `SELECT * FROM paquetes_viaje WHERE id = @0 AND activo = 1`,
        [dto.paqueteId],
      );
      if (!paquete) throw new BadRequestException('Paquete no disponible');

      const totalViajes = paquete.cantidad_viajes + paquete.viajes_bono;

      // Registrar transacción de compra
      const [transaccion] = await queryRunner.query(
        `INSERT INTO transacciones (pasajero_id, tipo, monto, viajes_cantidad, referencia_externa, estado, descripcion)
         OUTPUT INSERTED.id
         VALUES (@0, @1, @2, @3, @4, @5, @6)`,
        [
          pasajeroId,
          TipoTransaccion.RECARGA,
          paquete.precio,
          totalViajes,
          dto.referenciaExterna,
          EstadoTransaccion.COMPLETADA,
          `Compra paquete: ${paquete.nombre}`,
        ],
      );

      // Si el pasajero aún no tiene wallet, crearla con saldo 0 dentro
      // de la misma transacción antes de acreditar (en vez de fallar)
      const [wallet] = await queryRunner.query(
        `SELECT id FROM wallet_pasajeros WITH (UPDLOCK, HOLDLOCK) WHERE pasajero_id = @0`,
        [pasajeroId],
      );
      if (!wallet) {
        await queryRunner.query(
          `INSERT INTO wallet_pasajeros (pasajero_id, saldo_viajes, saldo_dinero)
           VALUES (@0, 0, 0)`,
          [pasajeroId],
        );
      }

      // Acreditar viajes al wallet
      const [saldoActualizado] = await queryRunner.query(
        `UPDATE wallet_pasajeros
         SET saldo_viajes = saldo_viajes + @0,
             fecha_actualizacion = GETDATE()
         OUTPUT INSERTED.saldo_viajes
         WHERE pasajero_id = @1`,
        [totalViajes, pasajeroId],
      );

      await queryRunner.commitTransaction();

      return {
        idempotente: false,
        transaccionId: transaccion.id,
        paquete: paquete.nombre,
        precio: paquete.precio,
        viajesAcreditados: totalViajes,
        saldoViajes: saldoActualizado.saldo_viajes,
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

  async historialTransacciones(userId: string, limite = 20) {
    const pasajeroId = await this.obtenerPasajeroId(userId);
    return this.dataSource.query(
      `SELECT TOP (@0) *
       FROM transacciones
       WHERE pasajero_id = @1
       ORDER BY fecha_creacion DESC`,
      [limite, pasajeroId],
    );
  }
}
