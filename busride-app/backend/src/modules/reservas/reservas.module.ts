import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reserva } from './entities/reserva.entity';
import { ReservasService } from './reservas.service';
import { ReservasCronService } from './reservas-cron.service';
import { ReservasController } from './reservas.controller';

// JwtService (firma/verificación del QR) llega del JwtModule GLOBAL registrado en AuthModule (T-12).
@Module({
  imports: [TypeOrmModule.forFeature([Reserva])],
  providers: [ReservasService, ReservasCronService],
  controllers: [ReservasController],
  exports: [ReservasService],
})
export class ReservasModule {}
