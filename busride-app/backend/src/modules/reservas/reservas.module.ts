import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reserva } from './entities/reserva.entity';
import { ReservasService } from './reservas.service';
import { ReservasCronService } from './reservas-cron.service';
import { ReservasController } from './reservas.controller';
import { ViajesModule } from '../buses/viajes.module';

// JwtService (firma/verificación del QR) llega del JwtModule GLOBAL registrado en AuthModule (T-12).
// ViajesModule exporta el TrackingGateway (F-09a): el abordaje emite la nueva
// disponibilidad de asientos por Socket.IO. No hay ciclo: ViajesModule no importa ReservasModule.
@Module({
  imports: [TypeOrmModule.forFeature([Reserva]), ViajesModule],
  providers: [ReservasService, ReservasCronService],
  controllers: [ReservasController],
  exports: [ReservasService],
})
export class ReservasModule {}
