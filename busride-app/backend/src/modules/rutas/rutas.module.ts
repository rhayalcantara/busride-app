import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ruta } from './entities/ruta.entity';
import { Parada } from './entities/parada.entity';
import { RutasService } from './rutas.service';
import { RutasController } from './rutas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ruta, Parada])],
  providers: [RutasService],
  controllers: [RutasController],
  exports: [RutasService],
})
export class RutasModule {}
