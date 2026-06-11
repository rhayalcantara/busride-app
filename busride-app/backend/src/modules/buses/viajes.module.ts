import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Viaje } from './entities/viaje.entity';
import { ViajesService } from './viajes.service';
import { ViajesController } from './viajes.controller';
import { TrackingGateway } from './tracking.gateway';

// JwtService (WsJwtGuard del TrackingGateway, F9) llega del JwtModule GLOBAL
// registrado en AuthModule (T-12) — secreto compartido vía JWT_SECRET.
@Module({
  imports: [TypeOrmModule.forFeature([Viaje])],
  providers: [ViajesService, TrackingGateway],
  controllers: [ViajesController],
  exports: [ViajesService, TrackingGateway],
})
export class ViajesModule {}
