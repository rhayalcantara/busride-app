import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bus } from '../buses/entities/bus.entity';
import { Horario } from '../buses/entities/horario.entity';
import { AsignacionBusRuta } from '../buses/entities/asignacion-bus-ruta.entity';
import { FlotaService } from './flota.service';
import { FlotaController } from './flota.controller';

// Módulo de gestión de flota: buses, horarios y asignaciones bus-ruta-conductor.
// Las entidades viven en ../buses/entities (creadas en la Ola 1); este módulo solo las consume.
// El registro en AppModule lo hace T-12.
@Module({
  imports: [TypeOrmModule.forFeature([Bus, Horario, AsignacionBusRuta])],
  providers: [FlotaService],
  controllers: [FlotaController],
  exports: [FlotaService],
})
export class FlotaModule {}
