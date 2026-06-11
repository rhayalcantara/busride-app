import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asociacion } from './entities/asociacion.entity';
import { AsociacionesController } from './asociaciones.controller';
import { AsociacionesService } from './asociaciones.service';

// NOTA: este módulo se registra en AppModule en la tarea T-12 (Ola 4)
@Module({
  imports: [TypeOrmModule.forFeature([Asociacion])],
  controllers: [AsociacionesController],
  providers: [AsociacionesService],
  exports: [AsociacionesService],
})
export class AsociacionesModule {}
