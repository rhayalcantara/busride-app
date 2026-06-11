import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conductor } from './entities/conductor.entity';
import { Calificacion } from './entities/calificacion.entity';
import { ConductoresController } from './conductores.controller';
import { ConductoresService } from './conductores.service';

// NOTA: este módulo se registra en AppModule en la tarea T-12 (Ola 4).
@Module({
  imports: [TypeOrmModule.forFeature([Conductor, Calificacion])],
  controllers: [ConductoresController],
  providers: [ConductoresService],
  exports: [ConductoresService],
})
export class ConductoresModule {}
