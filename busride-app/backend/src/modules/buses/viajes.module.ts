import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Viaje } from './entities/viaje.entity';
import { ViajesService } from './viajes.service';
import { ViajesController } from './viajes.controller';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Viaje])],
  providers: [ViajesService, TrackingGateway],
  controllers: [ViajesController],
  exports: [ViajesService, TrackingGateway],
})
export class ViajesModule {}
