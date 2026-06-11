import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// ⚠️ Este módulo NO se registra en AppModule aquí — lo hace T-12 (Ola 4).
@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
